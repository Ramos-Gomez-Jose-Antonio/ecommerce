const LocalStrategy = require("passport-local").Strategy
const bcrypt = require("bcrypt")
const mysql = require("mysql2")

const email = ""
const username = ""
const user_number_id = 0


async function isValidPassword(email, password) {
    const db = mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    });

    const query = 'SELECT * FROM usuarios WHERE correo = ?';
    
    try {
        const results = await new Promise((resolve, reject) => {
            db.query(query, [email], (err, results) => {
                if (err) reject(err);
                else resolve(results);
            });
        });

        if (results.length === 0) {
            console.log("User not found");
            return false;
        }

        const user = results[0];
        const validPassword = await bcrypt.compare(password, user.contra);
        return validPassword;
    } catch (error) {
        console.error("Error in isValidPassword:", error);
        return false;
    } finally {
        db.end(); // Close the database connection
    }
}

function initialize(passport) {
    const authenticateUsers = async (email, password, done) => {
        try {
            const isValid = await isValidPassword(email, password);
            if (isValid) {
                console.log("User authenticated");
                return done(null, email);
            } else {
                console.log("Authentication failed");
                return done(null, false, { message: "Error en la autenticacion :(" });
            }
        } catch (error) {
            console.error("Error in authenticateUsers:", error);
            return done(error);
        }
    };

    passport.use(new LocalStrategy({ usernameField: 'email' }, authenticateUsers));
    passport.serializeUser((user, done) => done(null, user));
    passport.deserializeUser((user, done) => done(null, user));
}


function getUserMail(){
    return email;
}

function getUserNumberId(){
    return user_number_id;
}

function getUserName(){
    return username;
}

module.exports = initialize;
