'use strict';
const { AdminConnection, BusinessNetworkConnection, BusinessNetworkDefinition, IdCard, MemoryCardStore, CertificateUtil } = require('./setup.js');
const Util = require('composer-common').Util;

const path = require('path');

const uuidv1 = require('uuid/v1');

const chai = require('chai');
const chaiAsPromised = require("chai-as-promised");
chai.use(chaiAsPromised);
chai.should();

const namespace = 'org.rynk';
const assetType = 'SampleAsset';

const choiceName = "Dobro";


describe('#' + namespace, async () => {
    // In-memory card store for testing so cards are not persisted to the file system
    const cardStore = require('composer-common').NetworkCardStoreManager.getCardStore( { type: 'composer-wallet-inmemory' } );
    let adminConnection;
    let businessNetworkConnection;
    let factory;

    before( async() => {
        //console.log("Global Before");
        // Embedded connection used for local testing
        const connectionProfile = {
          name: 'embedded',
          'x-type': 'embedded'
        };
        // Generate certificates for use with the embedded connection
        const credentials = CertificateUtil.generate({ commonName: 'admin' });

        // Identity used with the admin connection to deploy business networks
        const deployerMetadata = {
            version: 1,
            userName: 'PeerAdmin',
            roles: [ 'PeerAdmin', 'ChannelAdmin' ]
        };
        const deployerCard = new IdCard(deployerMetadata, connectionProfile);
        deployerCard.setCredentials(credentials);

        const deployerCardName = 'PeerAdmin';
        adminConnection = new AdminConnection({ cardStore: cardStore });

        await adminConnection.importCard(deployerCardName, deployerCard);
        await adminConnection.connect(deployerCardName);
    });

    beforeEach(async () => {
        //console.log("Global BeforeEach");
        businessNetworkConnection = new BusinessNetworkConnection({ cardStore: cardStore });

        const adminUserName = 'admin';
        let adminCardName;

        const businessNetworkDefinition = await BusinessNetworkDefinition.fromDirectory(path.resolve(__dirname, '..'));
        const businessNetworkName = businessNetworkDefinition.getName();
            // Install the Composer runtime for the new business network
        await adminConnection.install(businessNetworkDefinition);
        // console.log("Installed " + businessNetworkName + ": " + businessNetworkDefinition.getVersion());
        
        // Start the business network and configure an network admin identity
        const startOptions = {
            networkAdmins: [
                {
                    userName: adminUserName,
                    enrollmentSecret: 'adminpw'
                }
            ]
        };
        //debug
        // const EmbeddedConnection = require('composer-connector-embedded').EmbeddedConnection;
        // const chainCode = EmbeddedConnection.getInstalledChaincode(businessNetworkName, businessNetworkDefinition.getVersion());
        // console.log(JSON.stringify(chainCode));
        
        //\debug
        const adminCards = await adminConnection.start(businessNetworkName, businessNetworkDefinition.getVersion(), startOptions);
        // console.log("Started");
        
        // Import the network admin identity for us to use
        adminCardName = `${adminUserName}@${businessNetworkDefinition.getName()}`;
        await adminConnection.importCard(adminCardName, adminCards.get(adminUserName));

        // Connect to the business network using the network admin identity
        await businessNetworkConnection.connect(adminCardName);
        // console.log("Connected");
        

        factory = businessNetworkConnection.getBusinessNetwork().getFactory();

        //create a Choice
        await createChoice();
    });

    describe('Initially', async () => {
      it('should be zero votes', async () => {
        let voteRegistry = await businessNetworkConnection.getAssetRegistry(namespace + '.' + 'VotedChoice');
        let votes = await voteRegistry.getAll();
        votes.length.should.equal(0);
      });

      it('CanVote() doesnt throw', async () => {
        let transaction = factory.newTransaction(namespace, "CanVote");
        //let action = async () => await businessNetworkConnection.submitTransaction(transaction);
        let action = new Promise((resolve, reject) => {
            businessNetworkConnection.submitTransaction(transaction).then(resolve).catch(reject);
        });
        return action.should.be.fulfilled;
      });
    });


    async function createChoice() {
        let choice = factory.newResource(namespace, 'Choice', choiceName);
        let registry = await businessNetworkConnection.getAssetRegistry(namespace + '.' + 'Choice');
        await registry.add(choice);

        // console.log("Counting choices");
        // let choices = await registry.getAll();
        // console.log(choices.length);
    }


    describe('Voting for the first time', async () => {

      beforeEach(async () => {
        //Vote transaction
        const voteData = factory.newTransaction(namespace, 'Vote');
        voteData.votedChoice = factory.newRelationship(namespace, 'Choice', choiceName);
        voteData.uuid = uuidv1();
        await businessNetworkConnection.submitTransaction(voteData);
      });

      it('should be one vote in the registry for Our President', async () => {
        // console.log("Counting..");
        let voteRegistry = await businessNetworkConnection.getAssetRegistry(namespace + '.' + 'VotedChoice');
        let votes = await voteRegistry.getAll();
        votes.length.should.equal(1);
        votes[0].votedChoice.$identifier.should.equal(choiceName);
      });

      it('should be one vote in the Vote Results for Our President', async () => {
        let voteResults = await businessNetworkConnection.query('GetVoteResults');
        voteResults.length.should.equal(1);
        let vote = voteResults[0];
        vote.choiceName.should.equal(choiceName);
        vote.count.should.equal(1);
      });

      it('shouldn\'t be able to vote again', async () => {
        let canVoteTransaction = factory.newTransaction(namespace, "CanVote");
        
        //Vote should throw, too
        let voteTransaction = factory.newTransaction(namespace, 'Vote');
        voteTransaction.votedChoice = factory.newRelationship(namespace, 'Choice', choiceName);
        voteTransaction.uuid = uuidv1();

        return Promise.all([
          new Promise((resolve, reject) => {
            businessNetworkConnection.submitTransaction(canVoteTransaction).then(resolve).catch(reject);
          }).should.not.be.fulfilled,
          new Promise((resolve, reject) => {
            businessNetworkConnection.submitTransaction(voteTransaction).then(resolve).catch(reject);
          }).should.not.be.fulfilled
        ]);           
      });
    });

    describe('If there is one vote and we vote again', () => {
      beforeEach(async () => {
        //Initial vote
        let voteTotal = factory.newResource(namespace, 'VoteTotal', choiceName);
        voteTotal.votedChoice = factory.newRelationship(namespace, 'Choice', choiceName);
        voteTotal.count = 1;
        let voteRegistry = await businessNetworkConnection.getAssetRegistry(namespace + '.' + 'VoteTotal');
        await voteRegistry.add(voteTotal);

        //Vote transaction
        const voteData = factory.newTransaction(namespace, 'Vote');
        voteData.votedChoice = factory.newRelationship(namespace, 'Choice', choiceName);
        voteData.uuid = uuidv1();
        await businessNetworkConnection.submitTransaction(voteData);
      });

      it('Vote Results should show 2 votes', async () => {
        let voteResults = await businessNetworkConnection.query('GetVoteResults');
        voteResults.length.should.equal(1);
        let vote = voteResults[0];
        vote.choiceName.should.equal(choiceName);
        vote.count.should.equal(2);
        
      });
    });
});
