'use strict';

// Load environemnt variabels
require('dotenv').config();

// Application Dependencies
const express = require('express'); //Express does the heavy lifting
const cors = require('cors'); //Cross Origin Resource Sharing
const superagent = require('superagent');
const pg = require('pg'); //postgresql

// Application Setup
const app = express();
app.use(cors()); // tell express to use cors
const PORT = process.env.PORT;

//Connect to the database
const client = new pg.Client(process.env.DATABASE_URL);
client.connect();
client.on('error', err => console.log(err));



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

//What we need to do to refactor  for SQL storage
//1. We need to check the database to see if the location exists
// a. If it exists => get the location from the database
// b. return the location info to the front end
//2. If the location is not in the database
// a.Get the location from the API
// b. Run the data through the constructor
// c. Save it to the database
// d. Add the newlt added location id to the location object
// e. Return the location to the front

function searchToLatLong(request, response) {
  let query = request.query.data;

  //Define the search query
  let sql = `SELECT * FROM locations WHERE search_query=$1;`;
  let values = [query];

  //Make the query of the database
  client.query(sql, values)
    .then(result => {
      //Did the database return any info?
      if (result.rowCount > 0) {
        console.log('result from Database',result.rows[0]);
        response.send(result.rows[0]);
      } else {
        //Otherwise go get the data from the API
        const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${request.query.data}&key=${process.env.GEOCODE_API_KEY}`;

        superagent.get(url)
          .then(result => {
            if(!result.body.results.length) {
              throw 'NO DATA LOCATION';
            } else {
              let location = new Location(query, result.body.results[0]);

              let newSQL = `INSERT INTO locations (search_query, formatted_address, latitude, longitude) VALUES ($1, $2, $3, $4) RETURNING ID;`;
              let newValues = Object.values(location);

              client.query(newSQL, newValues)
                .then(data => {
                //attach the returning id to the location object
                  location.id = data.rows[0].id;
                  response.send(location);
                });
            }
          })
          .catch(err => handleError(err, response));
      }
    })
}
// Constructor for location data
function Location(query, location) {
  this.search_query = query;
  this.formatted_query = location.formatted_address;
  this.latitude = location.geometry.location.lat;
  this.longitude = location.geometry.location.lng;
}

function getWeather (request, response) {
  let query = request.query.data.id;

  //Define the search query
  let sql = `SELECT * FROM weathers WHERE search_query=$1;`;
  let values = [query];

  client.query(sql, values)
    .then(result => {
      if (result.rowCount > 0) {
        console.log('Weather from SQL');
        response.send(result.rows);
      } else {
        const url = `https://api.darksky.net/forecast/${process.env.WEATHER_API_KEY}/${request.query.data.latitude},${request.query.data.longitude}`;

        return superagent.get(url)
          .then(weatherResults => {
            console.log('Weather from API');
            if (!weatherResults.body.daily.data.length) {
              throw 'NO DATA WEATHER';
            } else {
              const weatherSummaries = weatherResults.body.daily.data.map(day => {
                let summary = new Weather(day);
                summary.id = query;

                let newSQL = `INSERT INTO locations (search_query, formatted_address, latitude, longitude) VALUES ($1, $2, $3, $4) RETURNING ID;`;
                let newValues = Object.values(location);
                client.query(newSQL, newValues);

                return summary;
              });
              response.send(weatherSummaries);
            }

          })
          .catch(err => handleError(err, response));
      }
    })
}


function Weather(day) {
  this.forecast = day.summary;
  this.time = new Date(day.time * 1000).toString().slice(0, 15);//taking the time in Epoch and converting it in to a string so its readable to the user.
}

// function getEventBrite(request, response) {
//   const url = `https://www.eventbriteapi.com/v3/events/search?token=${process.env.PERSONAL_OAUTH_TOKEN}&location.longitude=${request.query.data.longitude}&location.latitude=${request.query.data.latitude}&expand=venue`;

//   // console.log(url);

//   superagent.get(url)
//     .then(result => {
//       console.log(result);
//       const events = result.body.events.map(event => new Event(event));
//       response.send(events);
//     })
//     .catch(err => handleError(err, response));
// }

function getEventBrite (request, response) {
  let query = request.query.data.id;

  //Define the search query
  let sql = `SELECT * FROM weathers WHERE search_query=$1;`;
  let values = [query];

  client.query(sql, values)
    .then(result => {
      if (result.rowCount > 0) {
        console.log('Event from SQL');
        response.send(result.rows);
      } else {
        const url = `https://www.eventbriteapi.com/v3/events/search?token=${process.env.PERSONAL_OAUTH_TOKEN}&location.longitude=${request.query.data.longitude}&location.latitude=${request.query.data.latitude}&expand=venue`;

        return superagent.get(url)
          .then(eventResults => {
            console.log('Events from API');
            if (!eventResults.body.events.length) {
              throw 'NO DATA EVENTS';
            } else {
              const eventSummaries = eventResults.body.events.map(event => {
                let summary = new Event(event);
                summary.id = query;

                let newSQL = `INSERT INTO locations (search_query, formatted_address, latitude, longitude) VALUES ($1, $2, $3, $4) RETURNING ID;`;
                let newValues = Object.values(location);
                client.query(newSQL, newValues);

                return summary;
              })
              response.send(eventSummaries);
            }
          })
          .catch(err => handleError(err, response));
      }
    })
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
  if (response) response.status(500).send('OOPS');
}
