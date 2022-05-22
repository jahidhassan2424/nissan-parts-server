const express = require('express');
const cors = require('cors');
const app = express();
require('dotenv').config()
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
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
        //Reset Products data
        app.get('/productsReset', async (req, res) => {
            const getFromBackup = await toolsCollectionBackup.find().toArray();
            const copyInToolsCollection = await toolsCollection.insertMany(getFromBackup);
            res.send(copyInToolsCollection);
        })

        // get all products
        app.get('/products', async (req, res) => {
            const result = await toolsCollection.find().toArray();
            res.send(result)
        })

        //get single product by ID

        app.get('/product/:id', async (req, res) => {
            const id = req?.params.id;
            const result = await toolsCollection.findOne({ _id: ObjectId(id) })
            res.send(result)
        })

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



