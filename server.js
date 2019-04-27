'use strict';

// Load environemnt variabels
require('dotenv').config();

// Application Dependencies
const express = require('express'); //Express does the heavy lifting
const cors = require('cors'); //Cross Origin Resource Sharing
const superagent = require('superagent');

// Application Setup
const app = express();
app.use(cors()); // tell express to use cors
const PORT = process.env.PORT;

// Incoming API Routes
app.get('/location', searchToLatLong);
app.get('/weather', getWeather);
app.get('/events', getEventBrite);

// Make sure the server is listening for requests
app.listen(PORT, () => console.log(`Listening on PORT ${PORT}`));

app.get('/testing', (request, response) => {
  console.log('found the testing route')
  response.send('<h1>HELLO WORLD...</h1>')
});

// Helper Functions

function searchToLatLong(request, response) {
  //Define the URL for the GEOCODE API
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${request.query.data}&key=${process.env.GEOCODE_API_KEY}`;
  // console.log(url);

  superagent.get(url)
    .then(result => {
      const location = new Location(request.query.data, result);
      response.send(location);
    })
    .catch(err => handleError(err, response));
}

// Constructor for location data
function Location(query, res) {
  this.search_query = query;
  this.formatted_query = res.body.results[0].formatted_address;
  this.latitude = res.body.results[0].geometry.location.lat;
  this.longitude = res.body.results[0].geometry.location.lng;
}

function getWeather(request, response) {
  const url = `https://api.darksky.net/forecast/${process.env.WEATHER_API_KEY}/${request.query.data.latitude},${request.query.data.longitude}`;
  // console.log(url);

  superagent.get(url)
    .then(result => {
      //consoel.log(result.body);
      const weatherSummaries = result.body.daily.data.map(day => new Weather(day));
      response.send(weatherSummaries);
    })
    .catch(err => handleError(err, response));
}

function Weather(day) {
  this.forecast = day.summary;
  this.time = new Date(day.time * 1000).toString().slice(0, 15);//taking the time in Epoch and converting it in to a string so its readable to the user.
}

function getEventBrite(request, response) {
  const url = `https://www.eventbriteapi.com/v3/events/search?token=${process.env.PERSONAL_OAUTH_TOKEN}&location.longitude=${request.query.data.longitude}&location.latitude=${request.query.data.latitude}&expand=venue`;

  console.log(url);

  superagent.get(url)
    .then(result => {
      console.log(result);
      const events = result.body.events.map(event => new Event(event));
      response.send(events);
    })
    .catch(err => handleError(err, response));
}

// eventbrite constructor
function Event(events) {
  this.link = events.url;
  this.name = events.name.text;
  this.event_date = new Date(events.start.local).toDateString();
  this.summary = events.summary;
}


//Error Handler
function handleError(err, response) {
  console.error(err);
  if (response) response.status(500).send('OPPS');
}
