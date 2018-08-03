var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var mongoose = require('mongoose');
const passport = require('passport');
const gitHubStrategy = require('passport-github').Strategy;
const FacebookStrategy = require('passport-facebook').Strategy;

const session = require('express-session');
const MongoStore = require('connect-mongo')(session);
var User = require("./models/user");

//generateOrFindUser
function generateOrFindUser(accessToken, refreshToken, profile, done){
  if(profile.emails[0]){
    User.findOneAndUpdate({        // findOneAndUpdate takes a filter criteria (object) and updates (if we find the object, we should update it with the latest information) object
      email: profile.emails[0].value   //filter criteria object
    }, {
      name: profile.displayName || profile.username, //update object
      email: profile.emails[0].value,
      photo: profile.photos[0].value
    }, {
      upsert: true //option object, upsert inserts the model if it doesn't exist (new user and therefore no information to update)
    },
    done); //if there is an error from the upsert method, it will pass it to done as the first argument, and if the doc is found, it'll pass it to the second argument
  } else{
    const noEmailError = new Error('Your email privacy settings prevent you from signing into Bookworm!');
    done(noEmailError, null);
  }
}


//configure github strategy
passport.use(new gitHubStrategy({
  clientID: process.env.GITHUB_CLIENT_ID, // never put in your actual credentials inside id or secret during development or staging as this may be used for malicious intent when uploaded, or may cause issues in general practise when employees leave development and have that information inside
  clientSecret: process.env.GITHUB_CLIENT_SECRET, //(cont.) environmental variables(used here) is a workaround to this
  callbackURL: "http://localhost:3000/auth/github/return",
  scope: 'user:email'
}, generateOrFindUser))


//Facebook Strategy
passport.use(new FacebookStrategy({
  clientID: process.env.FACEBOOK_APP_ID,
  clientSecret: process.env.FACEBOOK_APP_SECRET,
  callbackURL: "http://localhost:3000/auth/facebook/return",
  profileFields: ['id', 'displayName', 'photos', 'email']
}, generateOrFindUser));

passport.serializeUser(function(user, done){  //translates data structure for storage (in this case the session data)
  done(null, user._id);                      //user argument is something complex like a mongoose or sequelize model
  });                                         //done argument is a callback function that takes 2 arguments, an error and a translation you want to store into the session


passport.deserializeUser(function(userId, done){ // to read the data that has been serialized, you need to deserialize it
  User.findById(userId, done); //we can use the done callback since the arguments are the same as the function(err, user), user being the document returned.
});


var routes = require('./routes/index');
const auth = require('./routes/auth');

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// mongodb connection
mongoose.connect("mongodb://localhost:27017/bookworm-oauth");
var db = mongoose.connection;

//Session config for passport and mongoDB
const sessionOptions = {
  secret: 'this is a super secret',
  resave: true,
  saveUninitialized: true,
  store: new MongoStore({
    mongooseConnection: db
  })
};

app.use(session(sessionOptions)) ;

//initialise passport
app.use(passport.initialize());

//restore session - this retains their session if a logged on user returns back to site
app.use(passport.session());


// mongo error
db.on('error', console.error.bind(console, 'connection error:'));

app.use('/', routes);
app.use('/auth', auth);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
  app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
      message: err.message,
      error: err
    });
  });
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
  res.status(err.status || 500);
  res.render('error', {
    message: err.message,
    error: {}
  });
});


module.exports = app;
