const express = require("express");
const client = require("mongodb").MongoClient;
const bodyParser = require("body-parser");
const http = require("http");
const path = require("path");
const cors = require("cors");
const socketio = require("socket.io");
const getDefaultMessages = require(path.join(__dirname,"config","default-messages.js"));
const getDefaultStatistics = require(path.join(__dirname,"config","default-statistics.js"));
const computeRating = require(path.join(__dirname, "config", "compute-rating.js"));
const updateStats = require(path.join(__dirname, "config", "update-stats.js"));

const PORT = process.env.PORT || 5000;
const URL = "mongodb://localhost:27017/"

const app = express();
const server = http.createServer(app);
const io = socketio(server, {
    cors: {
        origin: "http://localhost:3000",
        credentials: true,
        allowedHeaders: ["my-custom-header"]
    }
});

app.use(bodyParser.json());
app.use(cors());

const usersConnected = {};
const idToName = {};

// Web sockets communication for real time messaging

io.on("connection", (socket) => {
    socket.on("id", (data) => {
        const name = data.name;
        usersConnected[name] = socket.id;
        idToName[socket.id] = name;
    });

    socket.on("disconnecting", () => {
        delete usersConnected[idToName[socket.id]];
        delete idToName[socket.id];
    });

    socket.on("message", (msg, from, to) => {
        //TODO: Store this message in the database for both users
        const myUsername = from;
        const theirUsername = to;

        client.connect(URL, (err, db) => {
            if(err) throw err;
            var dbo = db.db("team26");
            var collection = "messages";
            var searchQuery = {"username": myUsername};

            dbo.collection(collection).findOne(searchQuery, (err, result) => {
                if(err) throw err;
                if(!result) throw err;
                var messages = result["messages"];
                if(theirUsername in messages){
                    messages[theirUsername].push(msg);
                }else{
                    messages[theirUsername] = [msg];
                }
                var newValues = {"messages": messages};
                dbo.collection(collection).updateOne(searchQuery, {$set : newValues}, (err, result) => {
                    if(err) throw err;
                    db.close();
                });
            });
        });

        client.connect(URL, (err, db) => {
            if(err) throw err;
            var dbo = db.db("team26");
            var collection = "messages";
            var searchQuery = {"username": theirUsername};
            dbo.collection(collection).findOne(searchQuery, (err, result) => {
                if(err) throw err;
                if(!result) throw err;
                var messages = result["messages"];
                var newMessage = {};
                if(myUsername in messages){
                    newMessage["who"] = "them";
                    newMessage["content"] = msg.content;
                    messages[myUsername].push(newMessage);
                }else{
                    newMessage["who"] = "them";
                    newMessage["content"] = msg.content;
                    messages[myUsername] = [newMessage];
                }
                if(theirUsername in usersConnected){
                    const theirId = usersConnected[theirUsername];
                    const theirSocket = io.sockets.sockets[theirId];

                    theirSocket.emit("new-message", newMessage);
                }
                var newValues = {"messages": messages};
                dbo.collection(collection).updateOne(searchQuery, {$set: newValues}, (err, result) => {
                    if(err) throw err;
                    db.close();
                });
            });
        });

    });
})

// Login API end point

app.get("/login", (req, res) => {
    const username = req.body.username.trim();
    const password = req.body.password;

    client.connect(URL, (err, db) => {
        if(err){
            db.close();
            return res.status(500);
        }else{
            var dbo = db.db("team26");
            var collection = "credentials";
            var searchQuery = {
                "username": username,
                "password": password
            }
            dbo.collection(collection).findOne(searchQuery, (err, result) => {
                if(err){
                    db.close();
                    return res.status(500);
                }else{
                    if(result){
                        db.close();
                        return res.json({
                            "msg": "Success!"
                        });
                    }else{
                        db.close();
                        return res.json({
                            "msg": "Failure!"
                        });
                    }
                }
            }); 
        }
    });
});

// Register API end point

app.post("/register", (req, res) => {
    const username = req.body.username.trim();
    const password = req.body.password;
    const confirmPassword = req.body.confirm;

    if(username.length < 4) return res.json({
        "msg": "Failure!",
        "reason": "Username needs to be 4 non whitespace charcters or more."
    });
    if(password !== confirmPassword){
        return res.json({
            "msg": "Failure",
            "reason": "The passwords do not match!"
        });
    }
    if(password.length < 6){
        return res.json({
            "msg": "Failure",
            "reason": "The password needs to be greater than 6 characters."
        });
    }
    client.connect(URL, (err, db) => {
        if(err){
            db.close();
            return res.status(500);
        }else{
            var dbo = db.db("team26");
            var searchQuery = {"username": username};
            var collection = "credentials";
            dbo.collection(collection).findOne(searchQuery, (err, result) => {
                if(err){
                    db.close();
                    return res.status(500);
                }else{
                    if(result){
                        db.close();
                        return res.json({
                            "msg": "Failure!",
                            "reason": "Username already exists!"
                        });
                    }else{
                        var newUser = {
                            "username": username,
                            "password": password
                        };
                        dbo.collection(collection).insertOne(newUser, (err, result) => {
                            if(err){
                                db.close();
                                return res.status(500);
                            }else{
                                var collection = "statistics";
                                var defaultStatistics = getDefaultStatistics(username);
                                dbo.collection(collection).insertOne(defaultStatistics, (err, result) => {
                                    if(err){
                                        db.close();
                                        return res.status(500);
                                    }else{
                                        var collection = "messages";
                                        var defaultMessages = getDefaultMessages(username);
                                        dbo.collection(collection).insertOne(defaultMessages, (err, result) => {
                                            if(err){
                                                db.close();
                                                return res.status(500);
                                            }else{
                                                db.close();
                                                res.json({
                                                    "msg": "Success!"
                                                });
                                            }
                                        });
                                    }
                                });
                            }
                        });
                    }
                }
            });
        }
    });
})

// Retreive Statistics API End Point

app.get("/statistics", (req, res) => {
    const username = req.body.username.trim();
    client.connect(URL, (err, db) => {
        if(err){
            db.close();
            res.status(500);
        }else{
            var dbo = db.db("team26");
            var collection = "statistics";
            var searchQuery = {"username": username}
            dbo.collection(collection).findOne(searchQuery, (err, result) => {
                if(err){
                    db.close();
                    return res.status(500);
                }else{
                    if(!result){
                        db.close();
                        return res.json({
                            "msg": "Failure!",
                            "reason": "No statistics found for this user."
                        });
                    }else{
                        db.close();
                        return res.json(result);
                    }
                }
            });
        }
    });
})

// Update current user rating

app.post("/update-rating", (req, res) => {
    const username = req.body.username.trim();
    const delta = parseInt(req.body.delta);

    client.connect(URL, (err, db) => {
        if(err){
            db.close();
            return res.status(500);
        }else{
            var dbo = db.db("team26");
            var collection = "statistics";
            var searchQuery = {"username": username};
            dbo.collection(collection).findOne(searchQuery, (err, result) => {
                if(err){
                    db.close();
                    return res.status(500);
                }else{
                    var ratings = result["rating-history"];
                    var rating = computeRating(ratings, delta);

                    ratings.push(rating);
                    var searchQuery = {"username": username};
                    var newValues = {
                        "current-rating": parseInt(rating),
                        "rating-history": ratings
                    }
                    dbo.collection(collection).updateOne(searchQuery,{$set : newValues}, (err, result) => {
                        if(err){
                            db.close();
                            return res.status(500);
                        }else{
                            db.close();
                            res.json({
                                "msg": "Success!"
                            });
                        }
                    });
                }
            });
        }
    });
})

// Add a new note on the statistics page

app.post("/add-note", (req, res) => {
    const username = req.body.username;
    const note = req.body.note;

    client.connect(URL, (err, db) => {
        if(err){
            db.close();
            return res.status(500);
        }else{
            var dbo = db.db("team26");
            var collection = "statistics";
            var searchQuery = {"username": username};
            dbo.collection(collection).findOne(searchQuery, (err, result) => {
                if(err){
                    db.close();
                    return res.status(500);
                }else{
                    var notes = result["notes"];
                    notes.push(note);
                    var newValues = {"notes" : notes};

                    dbo.collection(collection).updateOne(searchQuery, {$set : newValues}, (err, result) => {
                        if(err){
                            db.close();
                            return res.status(500);
                        }else{
                            db.close();
                            res.json({
                                "msg": "Success!"
                            });
                        }
                    });
                }
            });
        }
    });
})

// User completed a new question

app.post("/completed-question", (req, res) => {
    const username = req.body.username.trim();
    const question = req.body.question;

    client.connect(URL, (err, db) => {
        if(err){
            db.close();
            return res.status(500);
        }else{
            var dbo = db.db("team26");
            var collection = "statistics";
            var searchQuery = {"username": username};

            dbo.collection(collection).findOne(searchQuery, (err, result) => {
                if(err){
                    db.close();
                    return res.status(500);
                }else{
                    var questions = result["questions"];
                    var stats = result["statistics"];

                    questions.push(question);
                    stats = updateStats(stats, parseInt(question.rating));
                    var newValues = {
                        "questions": questions,
                        "statistics": stats
                    }
                    dbo.collection(collection).updateOne(searchQuery, {$set : newValues}, (err, result) => {
                        if(err){
                            db.close();
                            return res.status(500);
                        }else{
                            db.close();
                            res.json({
                                "msg": "Success!"
                            });
                        }
                    });
                }
            });
        }
    }); 
})

// TODO : Find a way to have a leaderboard


server.listen(PORT, () => {
    console.log("Server running on port "+PORT);
})