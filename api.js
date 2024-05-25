const express = require('express');
const passport = require('passport');
const FacebookStrategy = require('passport-facebook').Strategy;
const bodyParser = require('body-parser');
const fetch = require('node-fetch');
const session = require('express-session');
const path = require('path');
const FormData = require('form-data');

const app = express();
app.use(bodyParser.json());

app.use(session({
    secret: 'Your_Generated_Secret_Key',
    resave: false,
    saveUninitialized: false
}));

// Serve static files from the "public" directory
app.use(express.static(path.join(__dirname, 'public')));

const FACEBOOK_APP_ID = 'Your-App-ID';
const FACEBOOK_APP_SECRET = 'Your-App-Secret';
const FACEBOOK_CALLBACK_URL = 'http://localhost:3000/auth/facebook/callback';

passport.use(new FacebookStrategy({
    clientID: FACEBOOK_APP_ID,
    clientSecret: FACEBOOK_APP_SECRET,
    callbackURL: FACEBOOK_CALLBACK_URL,
    profileFields: ['id', 'displayName', 'photos']
}, (accessToken, refreshToken, profile, done) => {
    console.log("Access Token:", accessToken);
    console.log("User ID:", profile.id);

    // Fetch user's permissions
    fetch(`https://graph.facebook.com/${profile.id}/permissions?access_token=${accessToken}`)
        .then(response => response.json())
        .then(data => {
            console.log("Access Permissions:", data.data);
        })
        .catch(error => {
            console.error("Error fetching permissions:", error);
        });

    return done(null, { accessToken });
}));

passport.serializeUser((user, done) => {
    done(null, user);
});

passport.deserializeUser((obj, done) => {
    done(null, obj);
});

app.use(passport.initialize());
app.use(passport.session());

function ensureAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }
    res.status(401).json({ error: 'Unauthorized' });
}

app.get('/auth/facebook', passport.authenticate('facebook', { scope: ['pages_manage_metadata', 'pages_manage_engagement', 'pages_read_engagement', 'pages_manage_posts'] }));

app.get('/auth/facebook/callback',
    passport.authenticate('facebook', { successRedirect: '/pages', failureRedirect: '/login' }),
    (req, res) => {
        res.redirect('/pages');
    });

let globalPageAccessToken = null; 
let globalPageRequiredId = null;
app.get('/pages', ensureAuthenticated, async (req, res) => {
    try {
        const accessToken = req.user.accessToken;
        const response = await fetch(`https://graph.facebook.com/v19.0/me/accounts?access_token=${accessToken}`);
        const data = await response.json();

        const pages = data.data.map(page => ({
            id: page.id,
            name: page.name,
            accessToken: page.access_token // Include page access token
        }));

        // Log IDs and names of pages
        console.log("Pages:");
        data.data.forEach(page => {
            console.log("ID:", page.id);
            console.log("Name:", page.name);
            console.log("Page access Token:", page.access_token);
        });

        globalPageAccessToken = pages[0].accessToken;
        globalPageRequiredId = pages[0].id;

        res.json(pages);
        console.log('new generated Access_token is : ', globalPageAccessToken );
        console.log('Required Page id to Post is  : ', globalPageRequiredId);
    } catch (error) {
        console.error('Error retrieving pages:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});


app.post('/post', ensureAuthenticated, async (req, res) => {
    try {
        const photoUrl = "https://img.freepik.com/free-photo/3d-cartoon-style-character_23-2151034029.jpg?size=338&ext=jpg&ga=GA1.1.1369675164.1715472000&semt=ais_user";
        const message = "Test Post 02";

        // Use the globalPageAccessToken and globalPageRequiredId variable
        const pageId = globalPageRequiredId;
        const pageAccessToken = globalPageAccessToken;

        if (!pageAccessToken) {
            throw new Error('Page access token not available.');
        }

        const formData = new FormData();
        formData.append('url', photoUrl);
        formData.append('caption', message);
        formData.append('access_token', pageAccessToken);

        const response = await fetch(`https://graph.facebook.com/${pageId}/photos`, {
            method: 'POST',
            body: formData
        });

        const data = await response.json();
        res.json(data);
    } 
    catch (error) {
        console.error('Error posting photo:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
