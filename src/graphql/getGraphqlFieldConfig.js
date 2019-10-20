const { GraphQLList } = require('graphql');
const { xsdIri, rdfsLiteral, rdfsSubPropertyOf, rdfsRange, owlUnionOf,rdfFirst,rdfRest,rdfNil } = require('../constants');
const warn = require('../utils/warn');
const { walklook, resolveUnionResources } = require('../graph/traversal');
const memorize = require('../graph/memorize');
const requireGraphqlRelay = require('../requireGraphqlRelay');
const isGraphqlList = require('./isGraphqlList');
const getGraphqlDescription = require('./getGraphqlDescription');
const getGraphqlObjectType = require('./getGraphqlObjectType');
const getGraphqlScalarType = require('./getGraphqlScalarType');
const getGraphqlPolymorphicScalarType = require('./getGraphqlPolymorphicScalarType');
const getGraphqlPolymorphicObjectType = require('./getGraphqlPolymorphicObjectType');
const getGraphqlScalarResolver = require('./getGraphqlScalarResolver');
const getGraphqlObjectResolver = require('./getGraphqlObjectResolver');
const getRelayConnectionDefinitions = require('./getRelayConnectionDefinitions');

const isLiteral = iri => iri.startsWith(xsdIri) || iri === rdfsLiteral;

function getGraphqlFieldConfig(g, iri) {
  // Look for a range, return it if found
  // Otherwise for each super-property, look for a range,
  // if not found, check their super-properties and so on
  // TODO: check walklook, maybe test it
  const ranges = resolveUnionResources(g, [...walklook(g, iri, rdfsSubPropertyOf, rdfsRange)]);
  const nRanges = ranges.length;

  if (!nRanges) return;

  const fieldConfig = {
    description: getGraphqlDescription(g, iri),
  };

  if (ranges.every(isLiteral)) {
    fieldConfig.resolve = getGraphqlScalarResolver(g, iri);
    fieldConfig.type = nRanges === 1 ? getGraphqlScalarType(g, ranges[0]) : getGraphqlPolymorphicScalarType(g, ranges);
  }
  else if (ranges.some(isLiteral)) {
    return warn(`Mixed literal/non-literal ranges on ${iri}:\n${ranges}`);
  }
  else {
    fieldConfig.resolve = getGraphqlObjectResolver(g, iri, ranges);
    fieldConfig.type = nRanges === 1 ? getGraphqlObjectType(g, ranges[0]) : getGraphqlPolymorphicObjectType(g, ranges);
  }

  if (isGraphqlList(g, iri)) fieldConfig.type = new GraphQLList(fieldConfig.type);

  if (g.config.relay && g[iri].isRelayConnection) {
    fieldConfig.args = requireGraphqlRelay().connectionArgs;
    fieldConfig.type = getRelayConnectionDefinitions(g, ranges[0]).connectionType;
  }

  // Support partial overrides from user
  // full override is achieved with the memorize wrapper
  if (typeof g[iri].graphqlFieldConfigExtension === 'object') Object.assign(fieldConfig, g[iri].graphqlFieldConfigExtension);

  return fieldConfig;
}

module.exports = memorize(getGraphqlFieldConfig, 'graphqlFieldConfig');
