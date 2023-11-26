const express = require('express');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express();
const cors = require('cors');
require('dotenv').config();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)
const port = process.env.PORT || 5000;


// middleware
app.use(cors());
app.use(express.json());



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.w2tuwt2.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();


    const userCollection = client.db("contestDb").collection("users");
    const creatorCollection = client.db("contestDb").collection("creator");
    const contestCollection = client.db("contestDb").collection("contest");
    const paymentCollection = client.db("contestDb").collection("payments");
    // const userCollection = client.db("contestDb").collection("payments");
    
    // user related api 
    app.get('/users', async(req, res) => {
      const result = await userCollection.find().toArray();
        res.send(result);
      });


    app.post('/users', async(req, res) => {
      const user = req.body;

       // insert email if user doesnt exists:
      // you can do this many ways ( 1. email unique, 2. upsert 3. simple checking)
      const query = { email: user.email }
      const existingUser = await userCollection.findOne(query);
      if(existingUser){
        return res.send({message: 'user already exists', insertedId: null })
      }

      const result = await userCollection.insertOne(user);
      res.send(result);
    });

    // make admin 
    app.patch('/users/admin/:id', async(req, res) =>{
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) }
      const updatedDoc = {
        $set: {
          role: 'admin'
        }
      }
      const result = await userCollection.updateOne(filter, updatedDoc)
      res.send(result);

    })

    // user delete 
    app.delete('/users/:id', async(req, res) => {
      const id = req.params.id;
      const query = {_id: new ObjectId(id) }
      const result = await userCollection.deleteOne(query);
      res.send(result);
    })

    // creator api 
    app.post('/creator', async(req, res) => {
      const creator = req.body;
      const result = await creatorCollection.insertOne(creator);
      res.send(result);
    });


    app.get('/contest', async (req, res) => {
      const result = await contestCollection.find().toArray();
      res.send(result);
    });

    // details 
    app.get('/contest/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await contestCollection.findOne(query);
      res.send(result);
    });

    //  register
    app.get('/register', async (req, res) => {
      const result = await surveyCollection.find().toArray();
      res.send(result);
    });

    app.post('/register', async (req, res) => {
      const item = req.body;
      const result = await surveyCollection.insertOne(item);
      res.send(result);
    });
    //  payment 
    
    app.get('/payments', async (req, res) => {
      const result = await paymentCollection.find().toArray();
      res.send(result);
    });

    app.post('/create-payment-intent', async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);
      console.log('amount', amount);
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: 'usd',
        payment_method_types: ['card']
      });

      res.send({
        clientSecret: paymentIntent.client_secret
      })
    })

    //  send payment database 
    app.post('/payments', async (req, res) => {
      const payment = req.body;
      const paymentResult = await paymentCollection.insertOne(payment);

      console.log('payment info', payment);
      const query = {
        _id: {
          $in: payment.contestIds.map(id => new ObjectId(id))
        }
      };

      // const deleteresult = await contestCollection.deleteMany(query);

      res.send({ paymentResult })
    })



    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req, res) => {
  res.send('contest is running')
})

app.listen(port, () => {
  console.log(`Contest is running on port ${port}`);
})