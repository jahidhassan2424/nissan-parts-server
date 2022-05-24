const express = require('express');
const cors = require('cors');
const app = express();
const nodemailer = require('nodemailer');
require('dotenv').config()
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const query = require('express/lib/middleware/query');
const stripe = require('stripe')(process.env.STRIPE_PK_KEY);

const port = process.env.PORT || 5000;


// Middle Wire
app.use(cors());
app.use(express.json())

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.h2ts2.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });
async function run() {
    try {
        await client.connect();
        console.log("DB Connected");
        const toolsCollectionBackup = client.db("nissan").collection("productsBackup");
        const toolsCollection = client.db("nissan").collection("products");
        const singleCategoryToolsCollection = client.db("nissan").collection("singleCategory");
        const ordersCollection = client.db("nissan").collection("orders");
        //Reset Products data
        app.get('/productsReset', async (req, res) => {
            const getFromBackup = await toolsCollectionBackup.find().toArray();
            const copyInToolsCollection = await toolsCollection.insertMany(getFromBackup);
            res.send(copyInToolsCollection);
        });

        // get all products
        app.get('/products', async (req, res) => {
            const result = await toolsCollection.find().toArray();
            res.send(result)
        });

        //get single product by ID
        app.get('/product/:id', async (req, res) => {
            const id = req?.params.id;
            const result = await toolsCollection.findOne({ _id: ObjectId(id) })
            res.send(result)
        });

        // get user based orders 
        app.get('/myOrders', async (req, res) => {
            const email = req?.query.email;
            const result = await ordersCollection.find({ email: email }).toArray();
            res.send(result)
        });

        //Get single order by ID
        app.get('/singleOrder/:id', async (req, res) => {
            const id = req?.params;
            const query = { _id: ObjectId(id) };
            const result = await ordersCollection.findOne(query);
            res.send(result)
        })

        // post requests starts here 
        app.post('/orders', async (req, res) => {
            const info = req?.body;
            console.log(info);
            const result = await ordersCollection.insertOne(info);
            res.send(result)
        });

        //Send Email
        app.post('/email', async (req, res) => {
            const body = req.body;
            console.log(body);

            const toEmail = body.toEmail;
            const subject = body.subject;
            const text = body.text;
            console.log(body);

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
        app.post('/create-payment-intent', async (req, res) => {
            const price = req?.body.amount;
            const amount = price * 100;
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: 'usd',
                payment_method_types: ['card']
            });
            res.send({ clientSecret: paymentIntent.client_secret })
        });

        //Put Method Starts here
        app.put('/peymentStatus/:id', async (req, res) => {
            const id = req?.params.id;
            const query = { _id: ObjectId(id) }
            const options = { upsert: true };
            const updateDoc = {
                $set: {
                    'isPaid': true
                }
            }
            const result = await ordersCollection.updateOne(query, updateDoc, options);
            res.send(result)
        })



        //Delete method Starts Here
        // app.delete('/orders', async (req, res) => {
        //     const query = {}
        //     const result = await ordersCollection.deleteMany(query);
        //     res.send(result)
        // })





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



