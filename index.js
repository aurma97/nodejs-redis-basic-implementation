const express = require('express');
const fetch = require('node-fetch');
const redis = require('redis');

const PORT = process.env.PORT || 5000;
const REDIS_PORT = process.env.REDIS_PORT || 6379;

const client = redis.createClient(REDIS_PORT);

const app = express();

// Set Response

function setResponse(username, repos) {
    return {
        username,
        repos
    }
}


// Make request to github for data

async function getRepos(req, res, next) {
    try {
        console.log('Fetching Data...');

        const { username } = req.params;
        
        const response = await fetch(`https://api.github.com/users/${username}`);
        
        const data = await response.json();

        const repos = data.public_repos;

        // Set data to Redis
        client.setex(username, 3600, repos);

        res.status(200).json(setResponse(username, repos));

    } catch (error) {
        console.log(error);
        res.status(500);
    }
}

// Cache middleware
function cache(req, res, next) {
    const { username } = req.params;

    client.get(username, (err, data) => {
        if (err) throw err;

        if (data !== null) {
            res.status(200).json(setResponse(username, data))
        } else {
            next(); 
        }
    })
}


app.get('/repos/:username', cache, getRepos);

app.listen(PORT, () => {
    console.log(`App listening on port ${PORT}`)
});