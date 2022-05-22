const express = require('express');
const cors = require('cors');
const app = express();
require('dotenv').config()
const port = process.env.PORT || 5000;

// Middle Wire
app.use(cors());
app.use(express.json())


app.get('/', async (req, res) => {
    res.send("Working")
})

app.listen(port, () => {
    console.log('Listening to port', port,);

})



