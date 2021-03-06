const express = require('express');
const router = express.Router();
const SocialNetwork = require("../models/SocialNetwork");
const User = require('../models/User');
const bcrypt = require('bcrypt');
const sendGridEmail = require('@sendgrid/mail');
const ObjectId = require('mongoose').Types.ObjectId; 
const { verifyToken } = require('../helpers/auth');

sendGridEmail.setApiKey(process.env.SENDGRID_API_KEY);

// Register user
router.post('/register', async (req, res) => {
	const { email, name, password, confirmPassword } = req.body;

	if (!email || !name || !password || !confirmPassword)
		return res.status(400).json({ message: 'Missing fields' });

	const user = await User.findOne({ email });

	if (user)
		return res.status(409).json({ message: 'This email has already been taken' });

	if (password !== confirmPassword)
		return res.status(400).json({ message: 'Passwords don\'t match' });

	const salt = bcrypt.genSaltSync(256),
	hashedPassword = bcrypt.hashSync(password, salt);

	User.create({ email, name, password: hashedPassword})
		.then(user => {
			const encodedCode = encodeURIComponent(user._id);

			const confirmationEmail = {
				to: user.email,
				from: 'socialRESTapp@gmail.com',
				subject: 'Social REST: Confirm your account',
				html:
					`<body>
						<p>Hello ${user.name},
						Thanks for signing up!
						
						Please confirm your account with the following
						<a href="https://social-rest.herokuapp.com/account/confirm/${encodedCode}">
						link</a>
						${encodedCode}
						</p>
      		</body>`
			};

			sendGridEmail.send(confirmationEmail);

			res.status(201).json({
				message: `User was successfully created! An email was sent to ${user.email} to confirm the account`
			});
		})
		.catch(err =>
			res.status(500).json({ err, message: "We couldn't create the account" })
		);
});

// Confirms the user
router.get('/confirm/:id', (req, res) => {
	const confirmationCode = decodeURIComponent(req.params.id);

	User.findByIdAndUpdate(confirmationCode, { status: 'Active' })
		.then(() => res.status(200).json({ message: 'Account was successfully confirmed!' }))
		.catch(err =>
			res.status(500).json({ err, message: "We couldn't confirm the account" })
		);
});

// Retrieve user info
router.get('/details', verifyToken, (req, res) => {
	SocialNetwork.find({ owner: ObjectId(req.user._id) }, ['-token', '-tokenSecret'])
	.then(socialNetworks => res.status(200).json({ user: req.user, socialNetworks }))
	.catch(err => res.status(500).json({err, message: 'Unable to retrieve social networks'}))
});

// Update user details
router.patch('/:id', async (req, res) => {
	const { email, name } = req.body;

	const user = await User.findOne({ email: email });

	if (user)
		return res.status(400).json({ message: 'This email has already been taken' });

	if (!email || !name)
		return res.status(400).json({ message: 'Email/Name fields cannot be blank' });

	User.findByIdAndUpdate(req.params.id, { $set: req.body })
		.then(() => res.status(200).json({ message: 'User was successfully updated!' }))
		.catch(err =>
			res.status(500).json({ err, message: "We couldn't update the account" })
		);
});

// Delete user
router.delete('/:id', (req, res) => {
	User.findByIdAndDelete(req.params.id)
		.then(() =>
			res.status(200).json({ message: 'Account was successfully deleted' })
		)
		.catch(err =>
			res.status(500).json({ err, message: "We couldn't remove the content" })
		);
});

module.exports = router;
