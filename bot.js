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

client.on("loggedOn", (e) => {
    client.setPersona(3);
    client.getNicknames(() => {
        log_msg(`Logged in as ${client.accountInfo.name} / ${client.steamID}`);
        checkFriendRequests()
    });
    
});

client.on('err', function (e) {
    log_err(e)
});

community.on('sessionExpired', function(e) {
    log_msg('Session expired.');
    if (e) {
        log_err(e)
    }
});

client.on("webSession", (sessionid, cookies) => {
    manager.setCookies(cookies);
    community.setCookies(cookies);
});

manager.on("newOffer", (offer) => { //accept one sided, incoming trade offers
    if (offer.itemsToGive.length == 0 && offer.itemsToReceive.length > 0) {
        offer.accept((e, status) => {
            if (e) {
                log_err(e);
            } else {
                log_msg(`Accepting Offer #${offer.id} from ${offer.partner.getsteamID64()}.`);
            }
        });
    } else {
        log_msg(`Incoming Offer #${offer.id} from ${offer.partner.getsteamID64()}.`);
    }
});

manager.on("receivedOfferChanged", function(offer, oldState) { //log accepted trades
    if (offer.state == TradeOfferManager.ETradeOfferState.Accepted) {
        offer.getExchangeDetails((e, status, tradeInitTime, receivedItems, sentItems) => {
            if (e) {
                log_err(`Trade err: ${e}`);
                return;
            }
            let newReceivedItems = receivedItems.map(item => item.new_assetid);
            let newSentItems = sentItems.map(item => item.new_assetid);
            let newReceivedItemNames = "```";
            for (var i = 0; i < receivedItems.length; i++) {
                newReceivedItemNames+= receivedItems[i].market_name+"\n";
            }
            newReceivedItemNames+="```";
            log_msg(`Status: ${TradeOfferManager.ETradeStatus[status]}\n+${newReceivedItems.length}/-${newSentItems.length}\nItems Recieved: ${newReceivedItemNames}`);
        });
    }
});


client.on('friendMessage', function(steamID, message) {
    try{
        console.log(userContacted)
        if(message.includes("[/tradeoffer]") || message.includes("Invited you to play a game!")){
            return;
        }
        client.getPersonas([steamID], function(e, personas) {
            let persona = personas[steamID];
            let name = persona ? persona.player_name : ("[" + steamID + "]");
            if (!userContacted.includes(steamID.getSteam3RenderedID())){ //prevent people messaging me multiple times from being spammed with the automated message
                client.chatMessage(steamID, config.msg.replace("{USER}", persona.player_name));
                forwardSteamDM(`${name} (${steamID}) : ${message}\n(Auto-replied)`);
                userContacted.push(steamID.getSteam3RenderedID());
            } else {
                forwardSteamDM(`${name} (${steamID}) : ${message}`);
            }
        });
    } catch(e) {
        log_err(e);
    }
});

client.on("friendRelationship", function(steamID, relationship) {
    if (relationship == 2) {
        checkRequest(steamID);
    }
});

function checkFriendRequests() {
    log_msg(`Checking friend requests.`);
    for (let steamID in client.myFriends) {
        if (client.myFriends[steamID] == 2) {
            checkRequest(steamID);
        }
    }
}

function checkRequest(steamID) {
    client.getPersonas([steamID], function (e, personas) {
        if (e){
            log_err(e)
        }
        client.getSteamLevels([steamID], function (e, results) {
            if (e) {
                log_err(`Get Level err ${e}`);
            } else {
                let level = results[steamID];
                let persona = personas[steamID];
                if (level >= 10) {
                    client.addFriend(steamID);
                    client.chatMessage(steamID, config.msg.replace("{USER}", persona.player_name));
                    console.log(config.msg.replace("{USER}", persona.player_name));
                    log_msg(`Accepted FR from: ${persona.player_name} (${steamID}) | Level: ${level}`);
                    userContacted.push(steamID.getSteam3RenderedID());
                } else {
                    client.removeFriend(steamID);
                    log_msg(`Declined FR from: ${persona.player_name} (${steamID}) | Level: ${level}`);
                }
            }
        });
    });
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
        log_err(e);
    }
}
function forwardSteamDM(msg){
    try{
        const Hook = new webhook.Webhook(config.wh_msgs);
        var wh_msg = new webhook.MessageBuilder()
            .setName("SteamMsg")
            .setColor("#00ff00")
            .setDescription(msg)
            .setFooter(new Date(new Date().getTime()).toLocaleString());
        Hook.send(wh_msg);
    } catch(e) {
        log_err(e);
    }
}

function log_err(msg){
    try{
        const Hook = new webhook.Webhook(config.wh_errs);
        var wh_msg = new webhook.MessageBuilder()
            .setName("errLog")
            .setColor("#ff0000")
            .setDescription(msg)
            .setFooter(new Date(new Date().getTime()).toLocaleString());
        Hook.send(wh_msg);
    } catch(e) {
        console.log(e); //if this errors just print to console
    }
}
