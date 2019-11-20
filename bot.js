const SteamUser = require("steam-user");
const SteamTotp = require("steam-totp");
const webhook = require("webhook-discord")
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
var userContacted = [];
 
const logOnOptions = {
    accountName: config.username,
    password: config.password,
    twoFactorCode: SteamTotp.generateAuthCode(config.secret)
};

client.logOn(logOnOptions);

client.on("loggedOn", () => {
    client.setPersona(1);
    client.getNicknames(() => {
        log_msg(`Logged in as ${client.accountInfo.name} / ${client.steamID}`);
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
        log_msg(`Accepting Offer #${offer.id} from ${offer.partner.getSteamID64()}.`);
        offer.accept();
    } else {
        log_msg(`Incoming Offer #${offer.id} from ${offer.partner.getSteamID64()}.`);
    }
});

manager.on("receivedOfferChanged", function(offer, oldState) { //log accepted trades
    if (offer.state == TradeOfferManager.ETradeOfferState.Accepted) {
        offer.getExchangeDetails((err, status, tradeInitTime, receivedItems, sentItems) => {
            if (err) {
                log_msg(`Error ${err}`);
                return;
            }
            let newReceivedItems = receivedItems.map(item => item.new_assetid);
            let newSentItems = sentItems.map(item => item.new_assetid);
            let newReceivedItemNames = "```";
            for (var i = 0; i < receivedItems.length; i++) {
                newReceivedItemNames+= receivedItems[i].market_name+"\n";
            }
            newReceivedItemNames+="```"
            log_msg(`Status: ${TradeOfferManager.ETradeStatus[status]}\n+${newReceivedItems.length}/-${newSentItems.length}\nItems Recieved: ${newReceivedItemNames}`);
        });
    }
});

client.on("friendRelationship", function(steamID, relationship) {
    if (relationship == SteamUser.EFriendRelationship.RequestRecipient) {
        checkRequest(steamID);
    }
});

client.on('friendMessage', function(steamID, message) {
    if(message.includes("[/tradeoffer]") || message.includes("Invited you to play a game!")){
        return
    }
    client.getPersonas([steamID], function(err, personas) {
        let persona = personas[steamID.getSteamID64()];
        let name = persona ? persona.player_name : ("[" + steamID.getSteamID64() + "]");
        let currentTime = new Date().getTime()/1000;
        let nextMessageTime = userContacted[steamID]+3600; //this will add 3600 to undefined if not set, fix
        if (userContacted[steamID] == undefined || currentTime >= nextMessageTime){ //prevent people messaging me multiple times from being spammed with the automated message
            userContacted[steamID] = currentTime;
            client.chatMessage(steamID, `Hi ${name}, I don't tend to check my steam messages often. You're better contacting me via discord (Artemis#1237). This is an automated message.`);
            forwardSteamDM(`${name} (${steamID}) : ${message}\n(Auto-replied)`);
        } else {
            forwardSteamDM(`${name} (${steamID}) : ${message}`);
        }
    });
});

function checkRequest(steamID) {
    client.getSteamLevels([steamID], function(err, results){
        if (err) {
            log_msg(`Error ${err}`);
            return;
        } else {
            let userLevel = results[steamID];
            if (userLevel >= 100){
                client.addFriend(steamID);
                if (userContacted[steamID] == undefined || currentTime >= nextMessageTime){
                    userContacted[steamID] = currentTime;
                    client.chatMessage(steamID, `Hey, I'm afk right now (this is an automated message), if you let me know why you added me, I'll reply as soon as possible. For a faster reply you're better contacting me via discord (Artemis#1237).`);
                    log_msg(`Accepted friend request from ${steamID} (${userLevel}) and sent auto-message.`);
                }
            } else if (userLevel < 5) {
                client.removeFriend(steamID);
                log_msg(`Ignored friend request from ${steamID} due to their level (${userLevel})`);
            } else {
                log_msg(`Incoming friend request from ${steamID}.`);
            }
        }
    });
}

function checkFriendRequests(){
    log_msg(`Checking friend requests.`);
    for(let user in client.myFriends){
        if(client.myFriends[user] == 2){
            checkRequest(user);
        }
    }
}

function log_msg(msg){
    try{
        const Hook = new webhook.Webhook(config.wh_logs);
        var wh_msg = new webhook.MessageBuilder()
            .setName("BotLog")
            .setColor("#00ff00")
            .setDescription(msg)
            .setFooter(new Date(new Date().getTime()).toLocaleString());
        Hook.send(wh_msg);
    } catch(e) {
        log_error(e)
    }
}
function forwardSteamDM(msg){
    try{
        const Hook = new webhook.Webhook(config.wh_say);
        var wh_msg = new webhook.MessageBuilder()
            .setName("SteamMsg")
            .setColor("#00ff00")
            .setDescription(msg)
            .setFooter(new Date(new Date().getTime()).toLocaleString());
        Hook.send(wh_msg);
    } catch(e) {
        log_error(e)
    }
}

function log_error(msg){
    const Hook = new webhook.Webhook(config.wh_logs);
    Hook.err("ErrorLog", msg);
}
