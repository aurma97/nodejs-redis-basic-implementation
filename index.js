const express = require('express');
const fetch = require('node-fetch');
const redis = require('redis');
const axios = require('axios');
const responseTime = require('response-time');
const { promisify } = require('util');

const PORT = process.env.PORT || 5000;
const REDIS_PORT = process.env.REDIS_PORT || 6379;

const client = redis.createClient(REDIS_PORT);

// Redis set and get
const GET_ASYNC = promisify(client.get).bind(client);
const SET_ASYNC = promisify(client.set).bind(client);

const app = express();

app.use(responseTime());

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
        
        const response = await axios.get(`https://api.github.com/users/${username}`);
        
        const data = await response.data;

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

// Make request to spacex api
async function getRockets(req, res, next) {
    try {
        const reply = await GET_ASYNC('rockets')

        if (reply) {
            console.log('using cached data');
            res.send(JSON.parse(reply));
            return
        }

        const response = await axios.get('https://api.spacexdata.com/v3/rockets');
        const saveResult = await SET_ASYNC('rockets', JSON.stringify(response.data), 'EX', 5);

        console.log('new data cached', saveResult);

        res.send(response.data);
    } catch (err) {
        res.status(500).json({
            message: error.message
        })
    }
}

app.get('/rockets', getRockets);
app.get('/repos/:username', cache, getRepos);

app.listen(PORT, () => {
    console.log(`App listening on port ${PORT}`)
});