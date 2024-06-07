/****************************************
{
  "real_name" : "Kevin Marshall",
  "username": "",
  "password": "",
  "subscription" : {
    "status" : "trial"
  }
}
****************************************/

/****************************************
CREATE ACCOUNT
****************************************/
exports.create_account = async function(db, real_name, username, password) {
  let now = new Date()
  let account = {
    'real_name': real_name,
    'username': username,
    'password': password,
    'created': new Date(),
    'subscription': {
      'status': '',
    }
  }
  let accounts = db.get('accounts')
  accounts.update({'username': account['username']}, account, {replaceOne: true, upsert: true})
  return account
}

/****************************************
GET ACCOUNT BY USERNAME
****************************************/
exports.get_account_by_username = async function(db, username) {
  let accounts = db.get('accounts')
  return accounts.findOne({'username': username})
}

/****************************************
GET ACCOUNT BY STRIPE CUSTOMER
****************************************/
exports.get_account_by_stripe_customer = function(db, stripe_customer) {
  let accounts = db.get('accounts')
  return accounts.findOne({'subscription.stripe_customer': stripe_customer})
}

/****************************************
GET ACCOUNT BY STRIPE ID
****************************************/
exports.get_account_by_stripe_session_id = function(db, stripe_object_id) {
  let accounts = db.get('accounts')
  return accounts.findOne({'subscription.stripe_session_id': stripe_object_id})
}

/****************************************
SAVE ACCOUNT
****************************************/
exports.save_account = function(db, account) {
  account['last_update'] = new Date()
  let accounts = db.get('accounts')
  return accounts.update({'username': account['username']}, account, {replaceOne: true, upsert: true})
}