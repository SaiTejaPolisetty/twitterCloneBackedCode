const express = require("express");
const app = express();

module.exports = app;
app.use(express.json());
const path = require("path");
const pathToDb = path.join(__dirname, "twitterClone.db");
const sqlite3 = require("sqlite3");
const { open } = require("sqlite");

const bcrypt = require("bcrypt");
const jsonToken = require("jsonwebtoken");
let db = null;
let format = require("date-fns/format");
const initializingDbAndServer = async () => {
  try {
    db = await open({
      filename: pathToDb,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server Has Started");
    });
  } catch (e) {
    console.log(`Db Error: ${e.message}`);
    process.exit(1);
  }
};

initializingDbAndServer();

app.post("/register/", async (request, response) => {
  let { username, password, name, gender } = request.body;
  let checkForUserQuery = `
    SELECT *
    FROM user
    WHERE 
        username = '${username}';`;
  let userPresence = await db.get(checkForUserQuery);

  if (userPresence === undefined) {
    if (password.length < 6) {
      response.status(400);
      response.send("Password is too short");
    } else {
      password = await bcrypt.hash(password, 10);
      let addUserQuery = `
        INSERT INTO 
        user(name,username,password,gender)
        VALUES('${name}','${username}','${password}','${gender}');`;
      await db.run(addUserQuery);
      response.status(200);
      response.send("User created successfully");
    }
  } else {
    response.status(400);
    response.send("User already exists");
  }
});

app.post("/login/", async (request, response) => {
  let { username, password } = request.body;
  let checkForUserQuery = `
    SELECT *
    FROM user
    WHERE 
        username = '${username}';`;
  let userPresence = await db.get(checkForUserQuery);
  if (userPresence === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    let is_correct_password = await bcrypt.compare(
      password,
      userPresence.password
    );
    if (is_correct_password) {
      let jwtToken = jsonToken.sign(username, "saitejaserver");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

const authenticationFunction = (request, response, next) => {
  let authHeader = request.headers["authorization"];
  let tokenFromUser;
  if (authHeader !== undefined) {
    tokenFromUser = authHeader.split(" ")[1];
  }
  if (tokenFromUser === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jsonToken.verify(tokenFromUser, "saitejaserver", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload;
        next();
      }
    });
  }
};
//get tweets of the persons followed by user
app.get(
  "/user/tweets/feed/",
  authenticationFunction,
  async (request, response) => {
    let { username } = request;
    console.log(username);
    let checkForUserQuery = `
    SELECT *
    FROM user
    WHERE 
        username = '${username}';`;
    let userDetails = await db.get(checkForUserQuery);
    let user_id = userDetails.user_id;
    console.log(user_id);
    let getTweetsQuery = `
    SELECT user.username,tweet.tweet,tweet.date_time AS dateTime
    FROM user INNER JOIN follower ON user.user_id = follower.following_user_id  INNER JOIN tweet ON follower.following_user_id = tweet.user_id
    WHERE 
        follower.follower_user_id = ${user_id}
    ORDER BY
        dateTime DESC
    LIMIT
        4
    
    ;`;
    let tweets = await db.all(getTweetsQuery);
    response.send(tweets);
  }
);

app.get(
  "/user/following/",
  authenticationFunction,
  async (request, response) => {
    let { username } = request;
    let checkForUserQuery = `
    SELECT *
    FROM user
    WHERE 
        username = '${username}';`;
    let userDetails = await db.get(checkForUserQuery);
    let user_id = userDetails.user_id;
    let getTweetsQuery = `
    SELECT user.name
    FROM user INNER JOIN follower ON follower.following_user_id = user.user_id
    WHERE 
        follower.follower_user_id = ${user_id};`;

    let tweets = await db.all(getTweetsQuery);
    response.send(tweets);
  }
);

app.get(
  "/user/followers/",
  authenticationFunction,
  async (request, response) => {
    let { username } = request;
    let checkForUserQuery = `
    SELECT *
    FROM user
    WHERE 
        username = '${username}';`;
    let userDetails = await db.get(checkForUserQuery);
    let user_id = userDetails.user_id;
    let getTweetsQuery = `
    SELECT user.name
    FROM user INNER JOIN follower ON follower.follower_user_id = user.user_id
    WHERE 
        follower.following_user_id = ${user_id};`;

    let tweets = await db.all(getTweetsQuery);
    response.send(tweets);
  }
);
//get all
/*app.get("/all/", async (request, response) => {
  let getQuery = `
    SELECT * 
    FROM tweet;`;
  let dbResponse = await db.all(getQuery);
  response.send(dbResponse);
});*/
app.get(
  "/tweets/:tweetId/",
  authenticationFunction,
  async (request, response) => {
    let { username } = request;
    let { tweetId } = request.params;
    let checkForUserQuery = `
    SELECT *
    FROM user
    WHERE 
        username = '${username}';`;
    let userDetails = await db.get(checkForUserQuery);
    let user_id = userDetails.user_id;
    let getTweetsQuery = `
    SELECT tweet.tweet,SUM(like.like_id) AS likes,SUM(reply.reply_id) AS replies,tweet.date_time AS dateTime
    FROM  follower INNER JOIN tweet ON follower.following_user_id = tweet.user_id INNER JOIN reply ON tweet.tweet_id = reply.tweet_id INNER JOIN like ON tweet.tweet_id = like.tweet_id 
    WHERE 
        follower.follower_user_id = ${user_id} 
    GROUP BY 
        tweet.tweet_id
    Having
        tweet.tweet_id = ${tweetId}
    ;`;

    let tweets = await db.get(getTweetsQuery);
    if (tweets === undefined) {
      response.status(401);
      response.send("Invalid Request");
    } else {
      response.send(tweets);
    }
  }
);

app.get(
  "/tweets/:tweetId/likes/",
  authenticationFunction,
  async (request, response) => {
    let { username } = request;
    let { tweetId } = request.params;
    let checkForUserQuery = `
    SELECT *
    FROM user
    WHERE 
        username = '${username}';`;
    let userDetails = await db.get(checkForUserQuery);
    let user_id = userDetails.user_id;
    let getTweetsQuery = `
    SELECT  user.username AS likes
    FROM 
        user LEFT JOIN follower ON user.user_id = follower.following_user_id LEFT JOIN tweet ON follower.following_user_id = tweet.user_id LEFT JOIN like ON tweet.tweet_id = like.tweet_id 
    WHERE 
        follower.follower_user_id = ${user_id} AND like.tweet_id = ${tweetId}
    
   ;`;

    let likes = await db.all(getTweetsQuery);
    console.log(likes);
    let listOfUserNames = likes.map((obj) => obj.likes);
    console.log(listOfUserNames);

    if (likes[0] === undefined) {
      response.status(401);
      response.send("Invalid Request");
    } else {
      response.send({ likes: listOfUserNames });
    }
  }
);

app.get(
  "/tweets/:tweetId/replies/",
  authenticationFunction,
  async (request, response) => {
    let { username } = request;
    let { tweetId } = request.params;
    let checkForUserQuery = `
    SELECT *
    FROM user
    WHERE 
        username = '${username}';`;
    let userDetails = await db.get(checkForUserQuery);
    let user_id = userDetails.user_id;
    let getTweetsQuery = `
    SELECT  user.name AS name,reply.reply
    FROM 
        user LEFT JOIN follower ON user.user_id = follower.following_user_id LEFT JOIN tweet ON follower.following_user_id = tweet.user_id LEFT JOIN reply ON tweet.tweet_id = reply.tweet_id 
    WHERE 
        follower.follower_user_id = ${user_id} AND tweet.tweet_id = ${tweetId}
    ;`;

    let replys = await db.all(getTweetsQuery);
    console.log(replys);

    if (replys[0] === undefined) {
      response.status(401);
      response.send("Invalid Request");
    } else {
      response.send(replys);
    }
  }
);

app.get("/user/tweets/", authenticationFunction, async (request, response) => {
  let { username } = request;
  console.log(username);
  let checkForUserQuery = `
    SELECT *
    FROM user
    WHERE 
        username = '${username}';`;
  let userDetails = await db.get(checkForUserQuery);
  console.log(userDetails);
  let user_id = userDetails.user_id;
  let getTweetsQuery = `
    SELECT  tweet.tweet,sum(like.like_id) as likes, SUM(reply.reply_id) AS replies,tweet.date_time AS dateTime
    FROM 
        tweet INNER JOIN like ON tweet.tweet_id = like.tweet_id INNER JOIN reply ON tweet.tweet_id = reply.tweet_id
    WHERE 
        tweet.user_id =  ${user_id};
    ;`;

  let tweetsOfUser = await db.all(getTweetsQuery);
  console.log(tweetsOfUser);
  response.send(tweetsOfUser);
});

app.post("/user/tweets/", authenticationFunction, async (request, response) => {
  let { username } = request;
  let { tweet } = request.body;
  console.log(username);
  let checkForUserQuery = `
    SELECT *
    FROM user
    WHERE 
        username = '${username}';`;
  let userDetails = await db.get(checkForUserQuery);

  let user_id = userDetails.user_id;
  let dateTime = format(new Date(), "yyyy-MM-dd HH:MM:SS");
  let postTweetQuery = `
  INSERT INTO 
  tweet (tweet,user_id,date_time)
  VALUES ('${tweet}',${user_id},'${dateTime}');
  `;
  await db.run(postTweetQuery);
  response.send("Created a Tweet");
});

app.delete(
  "/tweets/:tweetId/",
  authenticationFunction,
  async (request, response) => {
    let { tweetId } = request.params;
    let { username } = request;
    let { tweet } = request.body;
    console.log(username);
    let checkForUserQuery = `
    SELECT *
    FROM user
    WHERE 
        username = '${username}';`;
    let userDetails = await db.get(checkForUserQuery);
    let user_id = userDetails.user_id;
    let getTweet = `
    SELECT *
    FROM tweet 
    WHERE 
        tweet_id = ${tweetId};
    `;
    let TweetFromId = await db.get(getTweet);

    let userIdOfTweet = TweetFromId.user_id;

    if (user_id === userIdOfTweet) {
      let DeleteTweetQuery = `
        DELETE FROM 
        tweet 
        WHERE 
            tweet_id = ${tweetId};`;
      await db.run(DeleteTweetQuery);
      response.send("Tweet Removed");
    } else {
      response.status(401);
      response.send("Invalid Request");
    }
  }
);
