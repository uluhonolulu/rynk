'use strict';
/**
 * Voting transaction
 * @param {org.rynk.Vote} voteData
 * @transaction
 */
async function Vote(voteData){
  var factory = getFactory();
  var namespace = "org.rynk";
  var currentParticipant = getCurrentParticipant();
  var currentUserId = currentParticipant.$identifier;

  //saving the actual vote, so that we could count it and get the results
  var vote = factory.newResource(namespace, 'VotedChoice', "123");  //TODO: auto ID
  vote.votedChoice = factory.newRelationship(namespace, 'Choice', voteData.votedChoice.name);
  let voteRegistry = await getAssetRegistry(namespace + '.' + 'VotedChoice');
  await voteRegistry.add(vote);

  var voter = factory.newResource(namespace, 'VotedUser', currentUserId);
  voteRegistry = await getAssetRegistry(namespace + '.' + 'VotedUser');
  await voteRegistry.add(voter);

  //quick and dirty
  let total = factory.newResource(namespace, 'VoteTotal', voteData.votedChoice.name);
  total.votedChoice = factory.newRelationship(namespace, 'Choice', voteData.votedChoice.name);
  total.count = 1;
  voteRegistry = await getAssetRegistry(namespace + '.' + 'VoteTotal');
  await voteRegistry.add(total);
}

/**
  * Check whether the current user can vote
  * @param {org.rynk.CanVote} canVoteData
  * @transaction
  */
function CanVote(canVoteData) {
  var namespace = "org.rynk";
  var factory = getFactory();
  var q = buildQuery("SELECT " + namespace + '.' + 'VotedUser WHERE (userName == _$userName)');//
  return query(q, { userName: getUserId() }).then(function (results) {
    // console.log("Query results");
    // console.log(results);
    var canVote = (results.length == 0);
  });

}


function getUserId(){
  var currentParticipant = getCurrentParticipant();
  return currentParticipant.$identifier;
}
