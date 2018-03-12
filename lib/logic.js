'use strict';
/**
 * Voting transaction
 * @param {org.rynk.Vote} voteData
 * @transaction
 */
function Vote(voteData){
  var factory = getFactory();
  var namespace = "org.rynk";
  var currentParticipant = getCurrentParticipant();
  var currentUserId = currentParticipant.$identifier;

  //saving the actual vote, so that we could count it and get the results
  var vote = factory.newResource(namespace, 'VotedChoice', "123");  //TODO: auto ID
  vote.votedChoice = factory.newRelationship(namespace, 'Choice', voteData.votedChoice.name);
  return getAssetRegistry(namespace + '.' + 'VotedChoice').then(function(voteRegistry) {
    return voteRegistry.add(vote).then(function() {
      voteRegistry.getAll().then(function (all) {
        // console.log("All VotedChoice instances:");
        // console.log(all);
      });
      //add UserVote, so that we could prevent from double voting
      var voter = factory.newResource(namespace, 'Voter', currentUserId);
      return getAssetRegistry(namespace + '.' + 'Voter').then(function(voteRegistry) {
        return voteRegistry.add(voter);
      });
    });

  });

}

/**
  * Check whether the current user can vote
  * @param {org.rynk.CanVote} canVoteData
  * @transaction
  */
function CanVote(canVoteData) {
  var namespace = "org.rynk";
  var factory = getFactory();
  var q = buildQuery("SELECT " + namespace + '.' + 'Voter WHERE (userName == _$userName)');//
  query(q, { userName: getUserId() }).then(function (results) {
    // console.log("Query results");
    // console.log(results);
    var canVote = (results.length == 0);

    var event = factory.newEvent(namespace, 'CanVoteResult');
    event.result = canVote;
    emit(event);
  });

}

/**
  * Get vote results
  * @param {org.rynk.GetVoteResults} getVoteResultsInput
  * @transaction
 */
function GetVoteResults(getVoteResultsInput) {
  var namespace = "org.rynk";
  var factory = getFactory();
  return getAssetRegistry(namespace + '.' + 'Choice')
    .then(function(choiceRegistry) {
      return choiceRegistry.getAll();
    })
    .then(function(allChoices) {
      var event = factory.newEvent(namespace, 'GetVoteResultsResult');
      var result = [];
      var counter = {}; //a plain object to count votes
      allChoices.forEach(function(choice){
        var choiceAndCount = factory.newConcept(namespace, 'ChoiceAndVoteCount');
        choiceAndCount.choiceName = choice.name;
        choiceAndCount.count = 0;
        result.push(choiceAndCount);

        //init counter
        counter[choice.name] = choiceAndCount;
      });
      // console.log("allChoices.length: " + allChoices.length);

      //now we count the voters
      getAssetRegistry(namespace + '.' + 'VotedChoice')
        .then(function(voteRegistry) {
          return voteRegistry.getAll();
        })
        .then(function(allVotes){
          // console.log("allVotes.length: " + allVotes.length);
          allVotes.forEach(function (vote) {
            counter["Dobro"].count = 1;
          });
          event.result = result;
          emit(event);
        }).catch(function(e){
          console.log(e);
          event.error = e.toString();
          emit(event);
        });

    });
}

function getUserId(){
  var currentParticipant = getCurrentParticipant();
  return currentParticipant.$identifier;
}
