#composer runtime install -c PeerAdmin@hlfv1 -n rynk
composer archive create  --sourceType dir --sourceName . -a ./dist/rynk.bna
composer network update -a ./dist/rynk.bna -c admin@rynk
#composer network deploy -a ./dist/rynk.bna -c PeerAdmin@hlfv1 -A admin -S adminpw
#composer card import -f admin\@rynk.card
#composer network start -a ./dist/rynk\@0.0.1.bna -A admin -S 123 -c PeerAdmin@hlfv1