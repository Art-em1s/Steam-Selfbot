const SteamUser = require("steam-user");
const SteamTotp = require("steam-totp");
const SteamCommunity = require("steamcommunity");
const TradeOfferManager = require("steam-tradeoffer-manager");
const config = require("/home/bot/SteamBot/data/config.json");
const client = new SteamUser();
const community = new SteamCommunity();
const manager = new TradeOfferManager({
    steam: client,
    community: community,
    language: "en"
});
 
const logOnOptions = {
    accountName: config.username,
    password: config.password,
    twoFactorCode: SteamTotp.generateAuthCode(config.secret)
};

client.logOn(logOnOptions);

client.on("loggedOn", () => {
    client.setPersona(1);
    client.getNicknames(() => {
        console.log(`[${new Date(new Date().getTime()).toLocaleString()}] Logged in as ${client.accountInfo.name} / ${client.steamID}`);
        checkFriendRequests();
    });
    
});

client.on("webSession", (sessionid, cookies) => {
    manager.setCookies(cookies);
    community.setCookies(cookies);
    community.startConfirmationChecker(20000, config.identitySecret);
});

manager.on("newOffer", (offer) => { //accept one sided, incoming trade offers
    if (offer.itemsToGive.length == 0 && offer.itemsToReceive.length > 0) {
        console.log(`[${new Date(new Date().getTime()).toLocaleString()}] Accepted Offer #${offer.id} from ${offer.partner.getSteamID64()}.`);
        offer.accept();
    }
});

manager.on("receivedOfferChanged", function(offer, oldState) { //log accepted trades
    if (offer.state == TradeOfferManager.ETradeOfferState.Accepted) {
        offer.getExchangeDetails((err, status, tradeInitTime, receivedItems, sentItems) => {
            if (err) {
                console.log(`[${new Date(new Date().getTime()).toLocaleString()}] Error ${err}`);
                return;
            }
            let newReceivedItems = receivedItems.map(item => item.new_assetid);
            let newSentItems = sentItems.map(item => item.new_assetid);
            console.log(`[${new Date(new Date().getTime()).toLocaleString()}] Status: ${TradeOfferManager.ETradeStatus[status]}\nReceived ${newReceivedItems.length} items\nSent ${newSentItems.length} items.`);
        });
    }
});

client.on("friendRelationship", function(steamID, relationship) {
    if (relationship == SteamUser.EFriendRelationship.RequestRecipient) {
        checkRequest(steamID);
    }
});

function checkRequest(steamID) {
    client.getSteamLevels([steamID], function(err, results){
        if (err) {
            console.log(`[${new Date(new Date().getTime()).toLocaleString()}] Error ${err}`);
            return;
        } else {
            let userLevel = results[steamID];
            if (userLevel < 5) {
                client.removeFriend(steamID);
                console.log(`[${new Date(new Date().getTime()).toLocaleString()}] Ignored friend request from ${steamID} due to their level (${userLevel})`);
            } else {
                console.log(`[${new Date(new Date().getTime()).toLocaleString()}] Incoming friend request from ${steamID}.`);
            }
        }
    });
}

function checkFriendRequests(){
    console.log(`[${new Date(new Date().getTime()).toLocaleString()}] Checking friend requests.`);
    for(let user in client.myFriends){
        if(client.myFriends[user] == 2){
            checkRequest(user);
        }
    }
}

