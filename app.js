let fs = require('fs')
let bodyParser = require('body-parser')
let bcrypt = require('bcrypt')
let cors = require('cors')
let cookieParser = require('cookie-parser')
let express = require('express')
let favicon = require('static-favicon')
let http = require('http')
let logger = require('morgan')
let mongo = require('mongodb')
let monk = require('monk')
let methodOverride = require('method-override')
let nunjucks = require('nunjucks')
let path = require('path')
let session = require('express-session')

require('dotenv').config()

let settings = {
  'host': process.env.HOST,
  'port': process.env.DB_PORT,
  'database': process.env.DATABASE,
  'cookie_secret': process.env.COOKIE_SECRET,
  'max_simultaneous_connections': 10,
  'read_only': false,
  'price_id': process.env.PRICE_ID,
  'service_url': process.env.SERVICE_URL,
  'stripe_key': process.env.STRIPE_KEY,
  'stripe_token': process.env.STRIPE_SECRET
}

let stripe = require('stripe')(settings.stripe_token)

/****************************************
DEFINE MODELS
****************************************/
let accounts_db = require('./models/accounts_db.js')

let app = express()

/****************************************
DEFINE DB CONNECTIONS AND CLIENT LIBRARY CONNECTIONS
****************************************/
let db = monk(settings['host'] + ':' + settings['port'] + '/' + settings['database'] + '?authSource=admin&directConnection=true')

/****************************************
VIEW ENGINE SETUP
****************************************/
nunjucks.configure('views', {
  autoescape: true,
  express: app
})
app.set('view engine', 'nunjucks');

app.use(logger('dev'))
app.use(bodyParser.json({type: 'application/json'}))
app.use(bodyParser.urlencoded({extended: true}))
app.use(cookieParser())
app.use(session({secret: settings['cookie_secret'], saveUninitialized: true, resave: true, cookie: { maxAge: 86400000 }}))
app.use(express.static(path.join(__dirname, 'public')))
app.use(cors())

/****************************************
ENSURE OUR MODELS, DB CONNECTION, AND PACKAGES ARE AVAILABLE TO ALL REQUESTS
****************************************/
app.use(function(req, res, next){
  req.accounts_db = accounts_db
  req.bcrypt = bcrypt
  req.db = db
  req.settings = settings
  req.stripe = stripe
  next()
})

/****************************************
DEFINE ROUTES
****************************************/
let accounts = require('./routes/accounts.js')
let general = require('./routes/general.js')

/****************************************
ENDPOINTS
****************************************/

/* ACCOUNT END POINTS */
app.post('/create/account',              accounts.create_account)
app.post('/sign/in',                     accounts.sign_in)
app.get('/subscribe',                    accounts.subscribe)

app.all('/dashboard',                    accounts.dashboard)
app.all('/sign/out',                     accounts.sign_out)

app.all('/create-checkout-session',      accounts.stripe_checkout_session) // used to trigger the subscription process
app.all('/create-portal-session',        accounts.stripe_portal_session)  // let's a user manage their subscription
app.all('/stripe/activate',              accounts.stripe_activate_subscription)  // webhook handling requests behind the scenes


/* GENERAL & CATCG ALL END POINT */
app.all('*',                             general.home_page)

/****************************************
catch 404 and forwarding to error handler
****************************************/
app.use(function(req, res, next) {let err = new Error('Not Found'); err.status = 404; next(err)})

/****************************************
development error handler; will print stacktrace
****************************************/
if (app.get('env') === 'development') {app.use(function(err, req, res, next) {res.render('error', {message: err.message, error: err});})}

/****************************************
production error handler; no stacktraces leaked to user
****************************************/
app.use(function(err, req, res, next) {res.render('error', {message: err.message, error: {}})})

module.exports = app
