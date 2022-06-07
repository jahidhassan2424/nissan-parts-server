const express = require('express');
const cors = require('cors');
const app = express();
const nodemailer = require('nodemailer');
require('dotenv').config()
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const query = require('express/lib/middleware/query');
const stripe = require('stripe')(process.env.STRIPE_PK_KEY);
const port = process.env.PORT || 3001;
const axios = require('axios');
const { format } = require('date-fns');

// Middle Wire
const corsConfig = {
    origin: '*',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE']
}

app.use(cors(corsConfig))
app.options("*", cors(corsConfig))
app.use(function (req, res, next) {
    res.header("Access-Control-Allow-Origin", "*")
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept,authorization")
    next()
})
app.use(express.json())

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.h2ts2.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

// Date Function
const date = new Date();

async function run() {
    try {
        await client.connect();
        console.log("DB Connected");
        const toolsCollectionBackup = client.db("nissan").collection("productsBackup");
        const toolsCollection = client.db("nissan").collection("products");
        const singleCategoryToolsCollection = client.db("nissan").collection("singleCategory");
        const ordersCollection = client.db("nissan").collection("orders");
        const usersCollection = client.db("nissan").collection("users");
        const reviewsCollection = client.db("nissan").collection("reviews");
        const contactEmailCollection = client.db("nissan").collection("contactUsEmail");
        // create json token function
        const generateAccessToken = (userData) => {
            return jwt.sign(userData, process.env.JWT_SECRET_KEY, { expiresIn: '1y' });
        }

        //JWT Verify
        function verifyJWT(req, res, next) {
            authHeader = req.headers.authorization;
            if (!authHeader) {
                return res.status(401).send({ message: 'UnAuthorized Access' });
            }
            else {
                const token = authHeader.split(' ')[1];
                jwt.verify(token, process.env.JWT_SECRET_KEY, function (err, decoded) {
                    // err
                    if (err) {
                        return res.status(403).send({ message: 'Forbidden' })
                    }
                    req.decoded = decoded;
                    // console.log("decoded", decoded);
                });
                next();
            }
        }
        //Verify admin
        async function verifyAdmin(req, res, next) {
            // const email = req.decoded.email;

            const requester = await usersCollection.findOne({ email: email });
            if (requester?.role === 'admin') {
                next();
            }
            else {
                res.status(403).send({ message: 'Forbidden Access' });
            }
        }

        //Reset Products data
        app.get('/productsReset', async (req, res) => {
            const getFromBackup = await toolsCollectionBackup.find().toArray();
            const copyInToolsCollection = await toolsCollection.insertMany(getFromBackup);
            res.send(copyInToolsCollection);
        });
        // get all products
        app.get('/products', async (req, res) => {
            const result = await toolsCollection.find().toArray();
            res.send(result);
        });
        //get single product by ID
        app.get('/product/:id', async (req, res) => {
            const id = req?.params.id;
            const result = await toolsCollection.findOne({ _id: ObjectId(id) })
            res.send(result)
        });
        // get user based orders 
        app.get('/myOrders', verifyJWT, async (req, res) => {
            const email = req?.query.email;
            const result = await ordersCollection.find({ email: email }).toArray();
            res.send(result)
        });
        //Get single order by ID
        app.get('/singleOrder/:id', async (req, res) => {
            const id = req?.params.id;
            const query = { _id: ObjectId(id) };
            const result = await ordersCollection.findOne(query);
            res.send(result)
        });

        //Get all users
        app.get('/users', verifyJWT, async (req, res) => {
            const result = await usersCollection.find().toArray();
            res.send(result)
        });

        //Get single users
        app.get('/users/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;
            const result = await usersCollection.findOne({ email: email });
            res.send(result);
        });

        //Verify admin
        app.get('/admin/:email', verifyJWT, async (req, res) => {
            const email = req?.params.email;
            const user = await usersCollection.findOne({ email: email });
            const isAdmin = user.role === 'admin';
            res.send(isAdmin)
        });

        // Get all Reviews
        app.get('/reviews', async (req, res) => {
            const result = await reviewsCollection.find().toArray();
            res.send(result);
        });

        //get all orders
        app.get('/orders', verifyJWT, async (req, res) => {
            const result = await ordersCollection.find().toArray();
            res.send(result)
        });
        //Test api
        app.get('/test', async (req, res) => {

            const postingTime = format(date, 'pp')
            const countTimeForNextMail = format(date, 'Hmm')
            const formatedDate = format(date, 'PP')
            console.log(formatedDate, postingTime, countTimeForNextMail);
        });



        // =======================================================================//
        // post requests starts here 
        // =======================================================================//
        app.post('/orders', async (req, res) => {
            const info = req?.body;
            const result = await ordersCollection.insertOne(info);
            res.send(result)
        });
        //Send Email
        app.post('/email', async (req, res) => {
            const body = req.body;
            const toEmail = body.toEmail;
            const subject = body.subject;
            const text = body.text;
            const transporter = nodemailer.createTransport({
                service: "hotmail",
                auth: {
                    user: "jahidhassan.programmer@outlook.com",
                    pass: "Lmnop@@##2424"
                }
            });
            const options = {
                from: "jahidhassan.programmer@outlook.com",
                to: `${toEmail}`,
                subject: `${subject}`,
                text: `${text}`
            }
            transporter.sendMail(options, function (err, info) {
                if (err) {
                    console.log(err);
                }
                console.log("Success Information", info);
            })
            res.send({ status: true })
        });
        //Stripe Payments
        app.post('/create-payment-intent', verifyJWT, async (req, res) => {
            const price = req?.body.amount;
            const amount = price * 100;
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: 'usd',
                payment_method_types: ['card']
            });
            res.send({ clientSecret: paymentIntent.client_secret })
        });

        app.post('/reviews/:email', async (req, res) => {
            const reviewDetails = req?.body?.reviewDetails;
            const email = req?.params.email;
            const query = { reviewerEmail: email, description: reviewDetails.description }
            const checkDuplicate = await reviewsCollection.findOne(query);
            if (checkDuplicate) {
                res.status(409).send({ message: "Cannot add same review twice. Change the description  and try again" })
            }
            else {
                const review = {
                    reviewerEmail: email,
                    reviewerName: reviewDetails.userName,
                    userPhotoUrl: reviewDetails.userPhotoUrl,
                    rating: reviewDetails.rating,
                    description: reviewDetails.description,
                }
                const result = await reviewsCollection.insertOne(review)
                res.send({ result })
            }
        });

        //send contact us email to admin
        app.post('/contactUs', async (req, res) => {
            const allAdmin = [];
            const admins = await usersCollection.find({ role: "admin" }).toArray()
            {
                admins.map(admin => allAdmin.push(admin.email))
            }

            const data = {
                name: req.body.name,
                toEmail: allAdmin,
                subject: "Contact us email from Nissan parts",
                text: `Sender Name:${req.body.name} Sender Email: ${req.body.email} Message:${req.body.message}`,
                senderEmail: req.body.email,
                postingDate: format(date, 'PP'),
                postingTime: format(date, 'pp'),
                countTimeForNextMail: format(date, 'Hm'),
            }

            const sendContactUsEmailToDB = {
                senderEmail: data.senderEmail,
                postingTime: data.postingTime,
                countTimeForNextMail: data.countTimeForNextMail,
            }
            //Check if sender sent email in last 10 minutes
            const checkPreviousEmailTime = await contactEmailCollection.findOne({ senderEmail: data.senderEmail })
            console.log('chkpr', checkPreviousEmailTime.countTimeForNextMail);
            console.log(format(date, "Hmm"));
            const countTime = (format(date, "Hmm") - checkPreviousEmailTime?.countTimeForNextMail);

            if (countTime < 3) {
                console.log('countTime', countTime);
                console.log(checkPreviousEmailTime?.countTimeForNextMail);
                res.status(429).send({ errorMessage: `Try again after ${10 - countTime} minutes` })
                // res.send(countTime)
            }

            else {
                //Delete previous record
                const checkPreviousEmailTime = await contactEmailCollection.deleteOne({ senderEmail: data.senderEmail })

                // //Send email request to API
                const response = await axios.post('http://localhost:3001/email', data)
                console.log(response.status);

                // //Note Down email sendign time and other info
                const contactUsInput = await contactEmailCollection.insertOne(data)
                console.log(contactUsInput);
                res.send(contactUsInput);
            }


        });


        //====================================================================//
        //Put Method Starts here
        //====================================================================//
        //Make  User
        app.put('/users/:email', async (req, res) => {
            const email = req?.params.email;
            const name = req?.body.currentUser.name;
            const userForToken = req?.body.currentUser;
            const filter = { email: email }
            const options = { upsert: true }
            const updateDoc = {
                $set: { email, displayName: name }
            }
            const result = await usersCollection.updateOne(filter, updateDoc, options);
            const accessToken = generateAccessToken(userForToken);
            res.send({ accessToken, result });
        });

        //Make Admin
        app.put('/makeAdmin/:email', verifyJWT, async (req, res) => {
            const email = req?.params.email;
            const query = { email: email };
            const options = { upsert: true }
            const updateDoc = {
                $set: { role: 'admin' }
            }
            const result = await usersCollection.updateOne(query, updateDoc, options);
            res.send(result)
        });

        //Remove Admin
        app.put('/removeAdmin/:email', verifyJWT, async (req, res) => {
            const email = req?.params.email;
            const query = { email: email };
            const options = { upsert: true }
            const updateDoc = {
                $set: { role: '' }
            }
            const result = await usersCollection.updateOne(query, updateDoc, options);
            res.send(result)
        });

        //Insert edited profile data
        app.put('/updateUser/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;
            const data = req?.body.data;
            const filter = { email: email };
            const options = { upsert: true };
            const updateDoc = {
                $set: {
                    displayName: data.displayName,
                    address: data.address,
                    phone: data.phone,
                    institute: data.institute,
                    linkedIn: data.linkedIn,
                    facebook: data.facebook,
                }
            }
            const result = await usersCollection.updateOne(filter, updateDoc, options);
            res.send(result);
        });



        //Payment Status Update
        app.put('/peymentStatus/:id', verifyJWT, async (req, res) => {
            const id = req?.params.id;
            const transactionId = req?.body.transactionIdDB;
            const query = { _id: ObjectId(id) }
            const options = { upsert: true };
            const updateDoc = {
                $set: {
                    'isPaid': true,
                    transactionID: transactionId
                }
            }
            const result = await ordersCollection.updateOne(query, updateDoc, options);
            res.send(result)
        });

        //Change Shipping
        app.put('/order/:id', verifyJWT, async (req, res) => {
            const id = req?.params.id;
            const query = { _id: ObjectId(id) }
            const options = { upsert: true }
            const updateDoc = {
                $set: {
                    isShipped: true
                }
            }
            const result = await ordersCollection.updateOne(query, updateDoc, options);
            res.send(result)
        });

        //Add new product
        app.put('/products', verifyJWT, async (req, res) => {
            console.log('hit');
            const data = req?.body;
            console.log('req.body', data.name);
            // const updateDoc = {
            //     name: data.name,
            //     brand: data.brand,
            //     category: data.category,
            //     price: data.price,
            //     description: data.description,
            //     img: data.img,
            //     availableQty: data.availableQty,
            //     minOrder: data.minOrder,
            //     itemSold: data.itemSold,
            //     rating: 5,
            // }
            const result = await toolsCollection.insertOne(data)
            res.send(result)
        });


        //=============================================================================//
        //Delete method Starts Here
        //=============================================================================//
        //delete all orders
        app.delete('/orders', async (req, res) => {
            const query = {}
            const result = await ordersCollection.deleteMany(query);
            res.send(result)
        });
        //Delete all users
        app.delete('/users', async (req, res) => {
            const query = {}
            const result = await usersCollection.deleteMany(query);
            res.send(result)
        });
        // Delete Single Order by ID
        app.delete('/order/:id', async (req, res) => {
            const id = req?.params.id;
            const query = { _id: ObjectId(id) }
            const result = await ordersCollection.deleteOne(query);
            res.send(result);
        });

        //Delete single product
        app.delete('/product/:id', verifyJWT, async (req, res) => {
            const id = req?.params.id;
            const result = await toolsCollection.deleteOne({ _id: ObjectId(id) });
            res.send(result)
        });

    }
    finally {
    }
}
run().catch(console.dir);
app.get('/', async (req, res) => {
    res.send("Working")
})
app.listen(port, () => {
    console.log('Listening to port', port,);
})
