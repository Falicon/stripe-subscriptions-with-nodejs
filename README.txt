This is a basic NodeJS (express framework) project to show the core concepts of charging for subscriptions via Stripe with Node.

The basic steps to prepare your local system:

1. Clone or Download this repo

2. Move into the folder on your local system and run

npm install

3. Download and install a local version of MongoDB Community Server (if you need help, see our Udemy crash course on MongoDB)

4. Download and install the stripe CLI ( see https://stripe.com/docs/stripe-cli )

The basic steps to run this demo on your local system:

1. Create your stripe account (and subscription product following the instructions in our Udemy crash course on Stripe Subscriptions)

2. Start your local mongo database:

./mongod --dbpath=data

3. Create an .env file in your project root directory with the following params (make sure to replace the YOUR_STRIPE with your own specific values)

# YOUR COOKIE SECRET (FOR SESSION COOKIES)
COOKIE_SECRET=stripe-demo-secret

# THE URL YOUR RUNNING YOUR SERVICE ON (for simplified stripe rediretions)
SERVICE_URL='http://localhost:3000'

# DATABASE CONNECTION INFO
HOST=127.0.0.1
DB_PORT=27017
DATABASE=stripe-demo

# STRIPE DETAILS
STRIPE_KEY=YOUR_STRIPE_KEY
STRIPE_SECRET=YOUR_STRIPE_KEY
PRICE_ID=YOUR_STRIPE_PRICE_ID

4. Start your local node server:

npm start

5. Start listening for events via the CLI

stripe listen --forward-to localhost:3000/stripe/activate

6. Visit your localhost within your web browser at http://localhost:3000 and test the app
