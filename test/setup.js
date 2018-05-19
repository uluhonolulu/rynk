module.exports = {
    MemoryCardStore: require('composer-common').MemoryCardStore,
    IdCard: require('composer-common').IdCard,
    AdminConnection: require('composer-admin').AdminConnection,
    BusinessNetworkDefinition: require('composer-common').BusinessNetworkDefinition,
    BusinessNetworkConnection: require('composer-client').BusinessNetworkConnection,
    CertificateUtil: require('composer-common').CertificateUtil,
    debug: false,

    // Objects created for testing
    adminConnection: {},
    businessNetworkDefinition: {},
    businessNetworkConnection: {}
  }
