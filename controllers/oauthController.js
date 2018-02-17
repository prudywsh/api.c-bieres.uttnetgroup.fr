const EtuUTTService = require('../services/EtuUTTService.js')
const jwtHelper = require('../helpers/jwtHelper')
const mongoose = require('mongoose')
const Admin = mongoose.model('Admin')
const Drinker = mongoose.model('Drinker')

const _returnJWT = (res, etuUTTUser, drinker, tokenObj) => {
  Admin.findOne({ login: etuUTTUser.data.login })
    .then(admin => res.status(200).json(jwtHelper.sign(drinker, tokenObj.access_token, admin || etuUTTUser.data.studentId == process.env.DEFAULT_ADMIN)))
    .catch(err => res.status(500).json(err))
}

/**
 * Get the oauth redirect link for EtuUTT
 *
 * @param  {request} req
 * @param  {response} res
 * @return {response}
 */
exports.getLink = function(req, res) {
  const redirectUri = EtuUTTService().oauthAuthorize()
  res.json({ redirectUri })
}

/**
 * Handle oauth callback. Check the authorization_code.
 * If valid, return a JWT with informations about the User
 *
 * @param  {request} req
 * @param  {response} res
 * @return {response}
 */
exports.callback = function(req, res) {
  if (!req.body.authorization_code) {
    return res.status(400).json({ message: "missing authorization code" })
  }

  let EtuUTT = EtuUTTService();
  let tokenObj;

  EtuUTT.oauthTokenByAuthCode(req.body.authorization_code)
  .then((data) => {
    tokenObj = data;
    // get the user's data
    return EtuUTT.publicUserAccount();
  })
  .then((etuUTTUser) => {
    Drinker.findOne({ studentId: etuUTTUser.data.studentId })
      .then(drinker => {
        // if drinker doesn't exist, create it
        if (drinker) {
          _returnJWT(res, etuUTTUser, drinker, tokenObj)
        } else {
          const newDrinker = new Drinker(etuUTTUser.data)
          newDrinker.save()
            .then(savedDrinker => _returnJWT(res, etuUTTUser, savedDrinker, tokenObj))
        }
      })
  })
  .catch((error) => {
    return res.status(500).json({ message: "An error occurs during communications with the api of EtuUTT: " + error})
  })
}
