/****************************************
CREATE AN ACCOUNT
/create/account
****************************************/
exports.create_account = async function(req, res) {
  // attempt to create an account for a given user
  let confirm_password = req.query.confirm_password || req.body.confirm_password || ''
  let username = req.query.username || req.body.username || ''
  let password = req.query.password || req.body.password || ''
  let phone = req.query.phone || req.body.phone || ''
  let real_name = req.query.real_name || req.body.real_name || ''

  account = {}
  msg = ''

  if (confirm_password != '' && confirm_password != password) {
    // passwords don't match so throw an error
    password = ''
  }

  if (password != '' && username != '') {
    let username_taken = await req.accounts_db.get_account_by_username(req.db, username)
    if (username_taken === null) {
      // seems OK to go ahead and create this account
      const hash2 = await req.bcrypt.hash(password.trim(), 10)
      await req.accounts_db.create_account(req.db, real_name, username, hash2)

      // get the account record we just created
      const account = await req.accounts_db.get_account_by_username(req.db, username)
      if (account == null) {
        res.redirect('/sign/in')
        return
      }

      // seems like we crated the account; so let's set the cookie and bounce to the dashboard
      res.cookie('current_user', account['username'], { maxAge: 86400000 })
      // bounce to dashboard
      res.redirect('/dashboard')
      return
    }

    msg = 'We could not create an account with the information provided. Please try again.'
    res.render(
      'homepage.html',
      {
        error: msg
      }
    )
    return
  }

  msg = 'You did not supply all the required information. Please try again.'

  // trouble creating the account; so show error
  res.render(
    'homepage.html',
    {
      error: msg
    }
  )
}

/****************************************
DASHBOARD
/dashboard
****************************************/
exports.dashboard = async function(req, res) {
  if (req.cookies.current_user === undefined) {
    // user doesn't appear to be signed in; bounce to the sign in page 
    res.redirect('/homepage')
    return
  }

  let stripe_session = req.query.stripe_session || req.body.stripe_sessions || ''
  let account = await req.accounts_db.get_account_by_username(req.db, req.cookies.current_user)
  if (account === null) {
    // we couldn't find the account for some reason (bounce back to sign in)
    res.redirect('/sign/in')
    return
  }

  // check subscription status (status blank OR status expired) AND stripe_session variable is empty
  if ((account['subscription']['status'] === '' || account['subscription']['status'] === 'expired') && stripe_session === '') {
    // bounce to subscription options
    res.redirect('/subscribe')
    return
  }

  // subscription in trial or active (or we just came back from the stripe checkout process); show the dashboard
  res.render('dashboard.html', {account: account})
}

/****************************************
SIGN IN
/sign/in
****************************************/
exports.sign_in = async function(req, res) {
  let password = req.query.password || req.body.password || ''
  let username = req.query.username || req.body.username || ''

  if (username.trim() != '' && password.trim() != '') {
    // try to find the account by the username
    let account = await req.accounts_db.get_account_by_username(req.db, username)
    if (account == null) {
      // username || password not correct
      res.render(
        'homepage.html',
        {
          'error': 'Username or password is not correct.'
        }
      )
      return
    }

    // check if the user provided the right password or not
    const result = await req.bcrypt.compare(password.trim(), account['password'])
    if (result) {
      // start session
      res.cookie('current_user', account['username'], { maxAge: 86400000 })
      // bounce to dashboard
      res.redirect('/dashboard')
      return
    }

    // password not correct
    re.render(
      'homepage.html',
      {
        'error': 'The password you provided is not correct.'
      }
    )
    return
  }

  // required field not provided
  res.render(
    'homepage.html',
    {
      'error': 'You did not provide all the required credentials.'
    }
  )
}

/****************************************
SIGN OUT
/sign/out
****************************************/
exports.sign_out = function(req, res) {
  // reset the session for the user
  res.clearCookie("current_user")
  req.session.destroy()
  res.redirect('/')
}

/****************************************
STRIPE ACTIVATE SUBSCRIPTION
/stripe/activate
****************************************/
exports.stripe_activate_subscription = async function(req, res) {
  let data = req.query.data || req.body.data || {}
  let event_type = req.query.type || req.body.type || ''

  if (event_type === 'checkout.session.completed') {
    console.log('CHECKOUT SESSION COMPLETE')
    // payment succeeded; potentially update the stripe_id on an account from object.id to object.subscription
    let account = await req.accounts_db.get_account_by_stripe_session_id(req.db, data['object']['id'])
    if (account !== undefined && account !== null) {
      account['subscription']['status'] = 'trial'
      account['subscription']['stripe_customer'] = data['object']['customer']
      account['subscription']['stripe_id'] = data['object']['subscription']
      await req.accounts_db.save_account(req.db, account)
      res.json({'status': 'success'})
      return
    }

    // TROUBLE activating subscription!
    res.json({'status': 'error'})
    return

  } else if (event_type === 'customer.subscription.created' || event_type === 'customer.subscription.updated') {
    console.log('SUBSCRIPTION CREATED')
    if (data['object']['status'] == 'trialing') {
      data['object']['status'] = 'trial'
    }

    let account = await req.accounts_db.get_account_by_stripe_customer(req.db, data['object']['customer'])
    if (account !== null) {
      account['subscription']['status'] = data['object']['status']
      await req.accounts_db.save_account(req.db, account)
      res.json({'status': 'success'})
      return
    }

    // TROUBLE creating a subscription!
    res.json({'status': 'error'})
    return

  } else if (event_type === 'customer.subscription.deleted') {
    console.log('SUBSCRIPTION DELETED')
    // handle subscription canceled automatically based upon your subscription settings. Or if the user cancels it.
    let account = await req.accounts_db.get_account_by_stripe_customer(req.db, data['object']['customer'])
    if (account !== undefined && account !== null) {
      account['subscription']['status'] = 'expired'
      await req.accounts_db.save_account(req.db, account)
      res.json({'status': 'success'})
      return
    }

    // TROUBLE cancelling a subscription!
    res.json({'status': 'error'})
    return

  }

  // console.log('IGNORED EVENT: ' + event_type)
  // not sure what kind of request was made; so just error out
  res.json({'status': 'error'})
}

/****************************************
STRIPE CHECKOUT SESSION (start the checkout process)
/create-checkout-session
****************************************/
exports.stripe_checkout_session = async function(req, res) {
  if (req.cookies.current_user === undefined) {
    res.redirect('/sign/in')
    return
  }

  try {
    let stripe = {'api_key': req.settings.stripe_token}

    const session = await req.stripe.checkout.sessions.create({
      line_items: [
        {
          'price': req.settings.price_id,
          'quantity': 1
        }
      ],
      mode: 'subscription',
      // subscription_data: {'trial_period_days': 7},
      success_url: req.settings.service_url + '/dashboard?stripe_session={CHECKOUT_SESSION_ID}',
      cancel_url: req.settings.service_url + '/subscribe',
    })

    // update the account with the stripe session
    let account = await req.accounts_db.get_account_by_username(req.db, req.cookies.current_user)
    if (account !== null) {
      account['subscription']['stripe_session_id'] = session.id
      await req.accounts_db.save_account(req.db, account)
      res.redirect(session.url)
      return

    }

  } catch (e) {
    res.render(
      'subscribe_error.html',
      {
        error: e,
        current_user: req.cookies.current_user
      }
    )
    return
  }

  res.render(
    'subscribe_error.html',
    {
      error: 'We had some trouble preparing your Stripe connection. Please try again.',
      current_user: req.cookies.current_user
    }
  )
  return
}

/****************************************
STRIPE PORTAL SESSION
/create-portal-session
****************************************/
exports.stripe_portal_session = async function (req, res) {
  if (req.cookies.current_user === undefined) {
    res.redirect('/sign/in')
    return

  }

  let stripe_data = {'api_key': req.settings.stripe_token}

  // get the stripe customer id from the account (instead of the URL);
  let account = await req.accounts_db.get_account_by_username(req.db, req.cookies.current_user)
  if (account !== undefined && account['subscription']['stripe_customer'] !== undefined && account['subscription']['stripe_customer'] != '') {
    try {
      const session = await req.stripe.billingPortal.sessions.create({
        customer: account['subscription']['stripe_customer'],
        return_url: req.settings.service_url + '/dashboard',
      })
      res.redirect(session.url)
      return

    } catch (error) {
      console.log(error)
      res.redirect('/dashboard')
      return

    }
  }

  res.redirect('/dashboard')
}

/****************************************
SUBSCRIBE
/subscribe
****************************************/
exports.subscribe = async function(req, res) {
  if (req.cookies.current_user === undefined) {
    res.redirect('/sign/in')
    return
  }

  let account = await req.accounts_db.get_account_by_username(req.db, req.cookies.current_user)
  if (account === null) {
    self.redirect('/sign/in')
    return
  }

  let stripe_key = req.settings.stripe_key

  res.render(
    'subscribe.html',
    {
      account: account,
      msg: '',
      stripe_key: stripe_key,
      current_user: req.cookies.current_user
    }
  )
}
