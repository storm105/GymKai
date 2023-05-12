/*
Name: Kai Yu Man
StudentID: 162280218
SenecaEmail: kman2@myseneca.ca
Date: 5 April 2023
Description: Assignment 5
Course: WEB322
Professor: Ms. Jenelle Chen
*/

// import express
const express = require("express");
const app = express();
const HTTP_PORT = process.env.PORT || 8080;

// defining a static assets folder (public folder)
const path = require('path');

// resources in 'public' folder is now accessible as if they're under '/'
app.use('/', express.static(path.join(__dirname, 'public')));

// configure express to receive form field data
app.use(express.urlencoded({ extended: true }))

// setup handlebars
const exphbs = require("express-handlebars");
app.engine(".hbs", exphbs.engine({
    extname: ".hbs",
    helpers: {
        json: (context) => { return JSON.stringify(context) }
    }
}));
app.set("view engine", ".hbs");

// setup express-sessions (to manage user login session)
const session = require('express-session')
app.use(session({
    secret: "the quick brown fox jumped over the lazy dog 1234567890",  // random string, used for configuring the session
    resave: false,
    saveUninitialized: true
}))


// data source
const mongoose = require('mongoose');

// connect to mongoDB  (and set database name as "web322A5" instead of "test")
mongoose.connect("mongodb+srv://dbUser:654321asdf@cluster0.pi7koz2.mongodb.net/web322A5?retryWrites=true&w=majority");
const Schema = mongoose.Schema;

const userSchema = new Schema({ username: String, password: String, isMember: Boolean });
const User = mongoose.model("users_collection", userSchema);

const classSchema = new Schema({ image: String, classname: String, length: Number, classid: String });
const Class = mongoose.model("classes_collection", classSchema);

const paymentSchema = new Schema({ username: String, amountpaid: Number });
const Payment = mongoose.model("payments_collection", paymentSchema);

const cartSchema = new Schema({ username: String, classid: String });
const Cart = mongoose.model("cart_colletion", cartSchema);


// endpoints
app.get("/", async (req, res) => {
    console.log(`[DEBUG] GET request received at / endpoint`)
    console.log(req.session)

    const classList = await Class.find().lean();

    const randomArray = [];

    // add 3 class into randomArray for random display on Index page
    for (let i = 0; i < 3; i++) {
        let randomNum = Math.floor(Math.random() * (classList.length));   // Returns a random integer from 0 to length-1 of productList 
        randomArray.push(classList[randomNum]);
    }

    return res.render("index", {
        layout: "primary",
        displayArray: randomArray,
        currentSession: req.session
    });
})

app.get("/auth", (req, res) => {
    res.render("authentication", { layout: "primary" });
})

app.post("/createAcct", async (req, res) => {
    console.log(`[DEBUG]  POST request received at /createAcct endpoint`)
    console.log(req.body)
    // 1. get values from form fields
    const usernameInput = req.body.username;
    const passwordInput = req.body.password;
    console.log(`[DEBUG]  SIGNUP: Email: ${usernameInput}`)
    // const userTypeFromUI = req.body.userType  // SELF NOTE:  userType NO NEED IN A5 ???????????????
    // console.log(`SIGNUP: Email: ${usernameInput}, Password: ${passwordInput}, User Type: ${userTypeFromUI}`)

    try {
        // Check if the user has an account already
        const userFromDB = await User.findOne({ username: usernameInput })
        if (userFromDB === null) {
            // New user:
            const userToAdd = User({ username: usernameInput, password: passwordInput });
            await userToAdd.save();

            // Log in the user in "session"
            req.session.hasLoggedInUser = true;
            req.session.username = userToAdd.username;

            // Divert user to subscribe monthly plan
            return res.render("monthplan", {
                layout: "primary",
                currentSession: req.session
            });
            // return res.render("monthplan", { layout: "primary", loggedIn: req.session.hasLoggedInUser });

        }
        else {  // Existing user:
            // return res.send(`ERROR: There is already a user account for ${usernameInput}`);
            return res.render("message", {
                layout: "primary",
                title: "Error",
                message: `"${usernameInput}" seems to be an existing user account. Press Login if you want to sign in.`,
                loggedIn: req.session.hasLoggedInUser
            });
        }
    }
    catch (err) {
        console.log(err);
    }
})

app.get("/memberPlan", async (req, res) => {
    console.log("[DEBUG] On the page of monthly membership plan signup");

    if (req.session.hasLoggedInUser !== true) {
        return res.render("message", {
            layout: "primary",
            title: "Error",
            message: "Please log in first to view this page",
            currentSession: req.session
        });
    }
    else {
        try {
            // update User collection AND req.session
            const existingUser = await User.findOne({ username: req.session.username });
            existingUser.isMember = true;
            req.session.isUserMember = true;
            existingUser.save();

            // update $75 membership fee to Payment collection
            const paymentToAdd = new Payment({
                username: req.session.username,
                amountpaid: 75
            })
            await paymentToAdd.save();
    
            console.log("[DEBUG] have updated user as monthly member!");

            // redirect user to Class Schedule
            const classList = await Class.find().lean();
            return res.render("classes", {
                layout: "primary",
                classes: classList,
                currentSession: req.session
            });
            // return res.render("classes", { layout: "primary", classes: classList, loggedIn: req.session.hasLoggedInUser });
            // return res.redirect("/classSch");

        } catch (err) {
            console.log(err)
        }
    }
})

app.get("/classSch", async (req, res) => {
    // console.log("[DEBUG] On the page of class schedule");
    try {
        const classList = await Class.find().lean();
        if (classList.length > 0) {
            return res.render("classes", {
                layout: "primary",
                classes: classList,
                currentSession: req.session
            });

        } else {
            // return res.send(" ERROR : unable to retrieve class schedule...");            
            return res.render("message", {
                layout: "primary",
                title: "Error",
                message: "Unable to retrieve class schedule.",
                currentSession: req.session
            });
        }

    } catch (err) {
        console.log(err);
    }
})

app.post("/bookNow/:classid", (req, res) => {

    if (req.session.hasLoggedInUser !== true) {
        return res.render("message", {
            layout: "primary",
            title: "Error",
            message: "To book a class, please log in first.",
            currentSession: req.session
        });

    } else {
        try {
            const addClassToCart = new Cart({
                username: req.session.username,
                classid: req.params.classid
            })
            // Save to database
            addClassToCart.save();
            // return res.send("")
            return res.render("message", {
                layout: "primary",
                title: "Class added",
                message: "You have added the class to the Shopping Cart!",
                currentSession: req.session
            });

        } catch (err) {
            console.log(err);
        }
    }
})

app.post("/login", async (req, res) => {
    console.log(`[DEBUG] POST request received at /login endpoint`);
    // console.log(req.body);
    // 1. get values from form fields
    const usernameInput = req.body.username;
    const passwordInput = req.body.password;
    console.log(`LOGIN Email: ${usernameInput}, Password: ${passwordInput}`);

    try {
        // 2. Query the database for a user that matches the specified email address
        const userFromDB = await User.findOne({ username: usernameInput });

        if (userFromDB === null) {
            // 3a. If user is not found, then display an error message
            return res.render("message", {
                layout: "primary",
                title: "Error",
                message: "This user does not exist. Please check again.",
                currentSession: req.session
            });
        }

        // 3b. If user is found, verify password
        if (userFromDB.password === passwordInput) {
            // 4. log the user in
            req.session.hasLoggedInUser = true;
            req.session.username = userFromDB.username;
            req.session.isUserMember = userFromDB.isMember;
            console.log(req.session);
            // return res.send("LOGIN SUCCESS: go back home!");
            return res.render("message", {
                layout: "primary",
                title: "LOGIN SUCCESS",
                message: "To book a class, click Class Schedule",
                currentSession: req.session
            });

        }
        else {
            return res.render("message", {
                layout: "primary",
                title: "Error",
                message: "Invalid password! Please try again.",
                currentSession: req.session
            });
        }

    } catch (err) {
        console.log(err);
    }
})

app.get("/logout", (req, res) => {
    console.log(`[DEBUG] LOGOUT requested...`)
    req.session.destroy();

    console.log(`Session destroyed...`);
    console.log(req.session);

    // res.send("You are logged out");
    return res.render("message", {
        layout: "primary",
        title: "Logged Out",
        message: "You have logged out from your account.",
        currentSession: req.session
    });
})

app.get("/userCart", async (req, res) => {
    if (req.session.hasLoggedInUser !== true) {
        return res.render("message", {
            layout: "primary",
            title: "Error",
            message: "Please log in first to view your shopping cart.",
            currentSession: req.session
        });

    } else {
        try {
            // userCart will contain username & classid:
            const userCartList = await Cart.find({ username: req.session.username }).lean();
            // classList will contain all attributes of ALL classes:
            const classList = await Class.find().lean();
            // mergeList will incorproate class details to userCartList
            const mergeList = userCartList;

            let calSubtotal = 0;
            let calTax = 0;
            let calTotal = 0;

            if (mergeList.length > 0) {

                for (let i = 0; i < mergeList.length; i++) {
                    for (let j = 0; j < classList.length; j++) {

                        if (mergeList[i].classid === classList[j].classid) {
                            mergeList[i].classname = classList[j].classname;
                            mergeList[i].length = classList[j].length;
                            break;
                        }
                    }
                }

                if (req.session.isUserMember !== true) {
                    calSubtotal = 25 * mergeList.length;
                    calTax = calSubtotal * 0.13;
                    calTotal = calSubtotal + calTax;
                }
                console.log(mergeList);
                return res.render("cart", {
                    layout: "primary",
                    cart: mergeList,
                    subtotal: calSubtotal,
                    tax: calTax,
                    total: calTotal,
                    currentSession: req.session
                });

            } else {
                return res.render("message", {
                    layout: "primary",
                    title: "Error",
                    message: "You do not have any classes in your cart.",
                    currentSession: req.session
                });
            }

        } catch (err) {
            console.log(err)
        }
    }
})

app.post("/pay", async (req, res) => {
    console.log(`user is in /PAY. Username : ${req.session.username}`);
    try {
        const paymentToAdd = new Payment({
            username: req.session.username,
            amountpaid: req.body.totalAmt
        })

        await paymentToAdd.save();

        // delete ALL classes of THIS USER from Cart collection
        const deleteUserCartItems = await Cart.deleteMany({
            username: req.session.username
        })

        console.log(`deleteUserCartItems.deletedCount = ${deleteUserCartItems.deletedCount}`);

        if (deleteUserCartItems === 0) {
            console.log(` [DEBUG] No item is deleted from shopping cart. This could be an error.`);
        }

        // return res.send("Thanks for your payment!");
        return res.render("message", {
            layout: "primary",
            title: "Payment Received",
            message: "Thanks for your payment!",
            currentSession: req.session
        });

    } catch (err) {
        console.log(err)
    }
})

app.post("/remove/:classID", async (req, res) => {
    console.log(`user is DELETING an item from shopping cart. Item is${req.params.classID}`);

    try {
        const deleteCartItem = await Cart.deleteOne({
            username: req.session.username,
            classid: req.params.classID
        })

        if (deleteCartItem.deletedCount > 0) {
            console.log(`Deleted an item from shopping cart. DeletedCount = ${deleteCartItem.deletedCount}`);
            // return res.send("A class has been deleted from your shopping cart.");
            return res.render("message", {
                layout: "primary",
                title: "Class removed",
                message: "A class has been removed from your shopping cart.",
                currentSession: req.session
            });

        } else {
            console.log(` [DEBUG] No item is deleted from shopping cart. This could be an error.`);
        }

    } catch (err) {
        console.log(err)
    }
})


//  START THE SERVER 
const onHttpStart = () => {
    console.log(`Server is running on port ${HTTP_PORT}`)
    console.log(`Press CTRL+C to exit`)
}

app.listen(8080, onHttpStart)
