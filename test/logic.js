'use strict';
const { AdminConnection, BusinessNetworkConnection, BusinessNetworkDefinition, IdCard, MemoryCardStore, CertificateUtil } = require('./setup.js');
const Util = require('composer-common').Util;

const path = require('path');

const uuidv1 = require('uuid/v1');

const chai = require('chai');
const chaiAsPromised = require("chai-as-promised");
chai.use(chaiAsPromised);
const should = chai.should();

const namespace = 'org.rynk';

const choiceName = "Dobro";
const choice2Name = "Zlo";
const userName = "joe";
const user2Name = "gil";

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
        

        factory = businessNetworkDefinition.getFactory();

        //create two Choices
        await createChoice(choiceName);
        await createChoice(choice2Name);
    });

    describe('Initially', async () => {
      it('should be zero votes', async () => {
        let voteRegistry = await businessNetworkConnection.getAssetRegistry(namespace + '.' + 'VoteTotal');
        let votes = await voteRegistry.getAll();
        votes.length.should.equal(0);
      });

      it('Vote doesn\'t exist', async () => {
        const connection = await getUserConnection(userName);
        let registry = await connection.getAssetRegistry(namespace + '.' + 'Ballot');
        let ballotExists = await registry.exists(userName);
        ballotExists.should.be.false;

      });
    });


    async function createChoice(choiceName) {
        let choice = factory.newResource(namespace, 'Choice', choiceName);
        choice.URL = "url";
        let registry = await businessNetworkConnection.getAssetRegistry(namespace + '.' + 'Choice');
        await registry.add(choice);

        // console.log("Counting choices");
        // let choices = await registry.getAll();
        // console.log(choices.length);
        // console.log(await registry.exists(choiceName));
        
    }


    describe('Voting for the first time', async () => {

      before(async () => {
        //Vote transaction
        this.connection = await getUserConnection(userName);
        await voteFor(userName, choiceName);
      });

      it('should be one vote in the Vote Results', async () => {
        let voteResults = await this.connection.query('GetVoteResults');
        voteResults.length.should.equal(1);
        let vote = voteResults[0];
        vote.choiceName.should.equal(choiceName);
        vote.count.should.equal(1);
      });

      it('Can read my vote', async () => {
        let registry = await this.connection.getAssetRegistry(namespace + '.' + 'Ballot');
        let ballotExists = await registry.exists(userName);
        ballotExists.should.be.true;

        let ballot = await registry.get(userName);
        ballot.votedChoice.$identifier.toString().should.equal(choiceName);
      });

    });

    describe('If there is one vote and we vote again', () => {
      beforeEach(async () => {
        //Initial vote
        await voteFor(user2Name, choiceName);

        //my vote
        await voteFor(userName, choiceName);
      });

      it('Vote Results should show 2 votes', async () => {
        let voteResults = await businessNetworkConnection.query('GetVoteResults');
        voteResults.length.should.equal(1);
        let vote = voteResults[0];
        vote.choiceName.should.equal(choiceName);
        vote.count.should.equal(2);
        
      });
    });

    describe('If there\'s some other\'s vote', async () => {
      
      beforeEach( async () => {
        voteFor(userName, choiceName);
      });

      it('We should not be able to read it', async () => {
        const userConnection = await getUserConnection(user2Name);
        let registry = await userConnection.getAssetRegistry(namespace + '.' + 'Ballot');
        
        let myVoteExists = await registry.exists(userName);
        myVoteExists.should.be.false;
      });
    });

    describe('If I voted and then voted differently', () => {
      beforeEach(async () => {
        //Initial vote
        await voteFor(userName, choiceName);

        //Different vote
        await voteFor(userName, choice2Name);
      });

      it('I should be able to see my last choice', async () => {
        var myVote = await getMyVote(userName);
        should.exist(myVote);
        myVote.choiceName.should.be.equal(choice2Name);
      });

      it('Should be one vote for my last choice', async () => {
        let count = await votesFor(choice2Name);
        count.should.be.equal(1);
      });

      it('Should be zero votes for my first choice', async () => {
        let count = await votesFor(choiceName);
        count.should.be.equal(0);        
      });
    });

    //we need to create a user identity and participant to simulate voting by a user
    async function getUserConnection(userName) {
      let participantRegistry = await businessNetworkConnection.getParticipantRegistry('org.rynk.User');
      let exists = await participantRegistry.exists(userName);
      if (!exists) {
        let participant = factory.newResource('org.rynk', "User", userName);
        await participantRegistry.add(participant);

        let identity = await businessNetworkConnection.issueIdentity('org.rynk.User' + '#' + userName, userName);
        let metadata= {
          userName,
          version : 1,
          enrollmentSecret: identity.userSecret,
          businessNetwork : "rynk"
        };
        const connectionProfile = {
          name: 'embedded',
          'x-type': 'embedded'
        };
        let newCard = new IdCard(metadata, connectionProfile);

        const cardName = userName + '@rynk';
        await cardStore.put(cardName, newCard);            
      }
  

      const userConnection  = new BusinessNetworkConnection({ cardStore });
      await userConnection.connect(userName + '@rynk');

      return userConnection;
    }

    async function voteFor(userName, choiceName){
      const voteData = factory.newTransaction(namespace, 'Vote');
      voteData.votedChoice = factory.newRelationship(namespace, 'Choice', choiceName);
      voteData.uuid = uuidv1();
      voteData.when = new Date();
      const connection = await getUserConnection(userName);
      await connection.submitTransaction(voteData);      
    }

    async function getMyVote(userName) {
      let connection = await getUserConnection(userName);
      let registry = await connection.getAssetRegistry(namespace + '.' + 'Ballot');
      var exists = await registry.exists(userName);
      if (!exists) {
        return null;
      }
      let ballot = await registry.get(userName);
      ballot.choiceName = ballot.votedChoice.$identifier;
      return ballot;
    }

    async function votesFor(choiceName) {
      let registry = await businessNetworkConnection.getAssetRegistry(namespace + '.' + 'VoteTotal');
      let exists = await registry.exists(choiceName);
      if (!exists) {
        return 0;
      }
      let total = await registry.get(choiceName);
      return total.count;
    }
});
