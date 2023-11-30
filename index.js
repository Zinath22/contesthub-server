const express = require('express');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express();
const cors = require('cors');
const jwt = require('jsonwebtoken');
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
    // await client.connect();


    const userCollection = client.db("contestDb").collection("users");
    const creatorCollection = client.db("contestDb").collection("creator");
    const contestCollection = client.db("contestDb").collection("contest");
    const paymentCollection = client.db("contestDb").collection("payments");
    const bestCollection = client.db("contestDb").collection("bestCreator");

    //  jwt related api 
    app.post('/jwt', async(req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: '1h'});
      res.send({token});
    })
    

    // middleware verify token 
    

      const verifyToken = (req, res, next) => {
        // console.log('inside verify token', req.headers.authorization);
        if (!req.headers.authorization) {
          return res.status(401).send({ message: 'unauthorized access' });
        }
        const token = req.headers.authorization.split(' ')[1];
        jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
          if (err) {
            return res.status(401).send({ message: 'unauthorized access' })
          }
          req.decoded = decoded;
          next();
        })
      }
  
      // use verify admin after verifyToken

      const verifyAdmin = async (req, res, next) => {
        const email = req.decoded.email;
        const query = { email: email };
        const user = await userCollection.findOne(query);
        const isAdmin = user?.role === 'admin';
        if (!isAdmin) {
          return res.status(403).send({ message: 'forbidden access' });
        }
        next();
      }

      const verifyCreator = async (req, res, next) => {
        const email = req.decoded.email;
        const query = { email: email };
        const user = await userCollection.findOne(query);
        const isCreator = user?.role === 'craetor';
        if (!isCreator) {
          return res.status(403).send({ message: 'forbidden access' });
        }
        next();
      }


    
    // user related api 
    app.get('/users',  async(req, res) => {
      
      const result = await userCollection.find().toArray();
        res.send(result);
      });

      // user admin check 

      app.get('/users/admin/:email',verifyToken, verifyAdmin,  async(req, res) =>{
       const email = req.params.email;
      if(email !== req.decoded.email){
        return res.status(403).send({message: 'forbidden access'})

      }
      const query = {email: email};
      const user = await userCollection.findOne(query);
      let admin = false;
      if(user){
        admin = user.role === 'admin';
      }
      res.send({admin});
      })


      app.get('/users/creator/:email',verifyToken, verifyAdmin,  async(req, res) =>{
       const email = req.params.email;
      if(email !== req.decoded.email){
        return res.status(403).send({message: 'forbidden access'})

      }
      const query = {email: email};
      const user = await userCollection.findOne(query);
      let creator = false;
      if(user){
        creator = user.role === 'creator';
      }
      res.send({creator});
      })


      



          //  update user profile
    app.get('/users/:id', async(req, res) =>{
      const id = req.params.id;
      const query = {_id: new ObjectId(id)}
      const result = await userCollection.findOne(query);
      res.send(result);
    });

// update profile

app.patch('/users/:id', async (req, res) => {
  try {
    const user = req.body;
    const id = req.params.id;
    const filter = { _id: new ObjectId(id) };
    const updatedDoc = {
      $set: {
        displayName: user.displayName,
        photoURL: user.photoURL,
      },
    };
    const result = await userCollection.updateOne(filter, updatedDoc);

    if (result.modifiedCount > 0) {
      res.status(200).json({ updated: true });
    } else {
      res.status(404).json({ updated: false });
    }
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

    // app.patch('/users/:id', async (req, res) => {
    //   const user = req.body;
    //   const id = req.params.id;
    //   const filter = { _id: new ObjectId(id) }
    //   const updatedDoc = {
    //     $set: {
    //       displayName: user.displayName,
    //       photoURL: user.photoURL
        

    //     }
    //   }
    //   const result = await userCollection.updateOne(filter, updatedDoc)
    //   res.send(result);
    // })


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
    app.patch('/users/admin/:id',verifyToken, verifyAdmin, async(req, res) =>{
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) }
      const updatedDoc = {
        $set: {
          role: 'admin'
        }
      }
      const result = await userCollection.updateOne(filter, updatedDoc)
      res.send(result);

    });

    /// make creator
    
    app.patch('/users/creator/:id',verifyToken,verifyAdmin, async(req, res) =>{
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) }
      const updatedDoc = {
        $set: {
          role : 'creator'
        }
      }
      const result = await userCollection.updateOne(filter, updatedDoc)
      res.send(result);

    });
    
    app.patch('/users/user/:id',verifyToken,verifyAdmin, async(req, res) =>{
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) }
      const updatedDoc = {
        $set: {
          role : 'user'

        }
      }
      const result = await userCollection.updateOne(filter, updatedDoc)
      res.send(result);

    });

    // make winner 

    app.patch('/payments/winner/:id',verifyToken, verifyCreator, async(req, res) =>{
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) }
      const updatedDoc = {
        $set: {
          winner: true
        }
      }
      const result = await paymentCollection.updateOne(filter, updatedDoc)
      res.send(result);

    })


    // user delete 
    app.delete('/users/:id',verifyToken, verifyAdmin, async(req, res) => {
      const id = req.params.id;
      const query = {_id: new ObjectId(id) }
      const result = await userCollection.deleteOne(query);
      res.send(result);
    })

    // creator api 




    app.post('/creator',verifyToken,verifyCreator, async(req, res) => {
      const creator = req.body;
      const result = await creatorCollection.insertOne(creator);
      res.send(result);
    });

   

  // contest api 
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
    
    // add item 
    app.post('/contest', async(req, res) =>{
      const item = req.body;
      const result = await contestCollection.insertOne(item);
      res.send(result);
    });

    //  update item 
    app.get('/contest/:id', async(req, res) =>{
      const id = req.params.id;
      const query = {_id: new ObjectId(id)}
      const result = await contestCollection.findOne(query);
      res.send(result);
    });

// update 
    app.patch('/contest/:id', async (req, res) => {
      const item = req.body;
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) }
      const updatedDoc = {
        $set: {
          contest_name: item.contest_name,
          img: item.img,
          tag: item.tag,
          fee: item.fee,
          description: item.description,
          instruction: item.instruction,
          prize: item.prize,
          deadline: item.deadline

        }
      }
      const result = await contestCollection.updateOne(filter, updatedDoc)
      res.send(result);
    })


    

    app.delete('/contest/:id', async (req, res) => {
      const id = req.params.id;
      const query = {_id: new ObjectId(id)}
      const result = await contestCollection.deleteOne(query);
      res.send(result);
     });

    //  approve


    app.patch('/contest/creator/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          status: "accepted"
        }
      }
      const result = await contestCollection.updateOne(filter, updatedDoc);
      res.send(result);
    })

    // app.patch('/contest/:id', async(req, res) =>{
    //   const id = req.params.id;
    //   const filter = { _id: new ObjectId(id) }
    //   const updatedDoc = {
    //     $set: {
    //       status: 'accepted'
    //     }
    //   }
    //   const result = await contestCollection.updateOne(filter, updatedDoc)
    //   res.send(result);

    // })

    //  register
    app.get('/bestCreator', async (req, res) => {
      const result = await bestCollection.find().toArray();
      res.send(result);
    });
    app.get('/register', async (req, res) => {
      const result = await creatorCollection.find().toArray();
      res.send(result);
    });

    app.post('/register', async (req, res) => {
      const item = req.body;
      const result = await creatorCollection.insertOne(item);
      res.send(result);
    });

      // payment intent 
      app.post('/create-payment-intent', async(req, res) =>{
        const {price} = req.body;
        const amount = parseInt(price * 100);
        console.log(amount, 'amount')
  
        const paymentIntent = await stripe.paymentIntents.create({
          amount: amount,
          currency: 'usd',
          payment_method_types: ['card']
        });
        res.send({
          clientSecret: paymentIntent.client_secret
        })
      });
  




      // 
      // payment 

      app.get('/payments', async(req, res) => {
        const result = await paymentCollection.find().toArray();
        res.send(result);
     });

     app.get('/payments/:id', async(req, res) =>{
      const id = req.params.id;
      const query = {_id: new ObjectId(id)}
      const result = await paymentCollection.findOne(query);
      res.send(result);
    });

      app.get('/payments/:email', async(req, res) => {
        const query = { email: req.params.email }
        if(req.params.email !== req.decoded.email){
              return res.status(403).send({message: 'forbidden access'});
        }
        const result = await paymentCollection.find(query).toArray();
        res.send(result);
      });
  
  
      app.post('/payments', async(req, res) => {
        const payment = req.body;
        const paymentResult = await paymentCollection.insertOne(payment);
  
        // carefully delete each item from cart 
        console.log('payment info', payment);
        // const query = {_id: {
        //   $in: payment.cartIds.map(id => new ObjectId(id))
        // }};
  
        // const deleteResult = await cartCollection.deleteMany(query);
  
        res.send({paymentResult});
      });
      // stats 
      app.get('/order-stats',verifyToken, verifyAdmin, async(req, res) => {
        const result = await paymentCollection.aggregate([
          {
            $unwind: '$menuItemIds'
          },
          {
            $lookup: {
              from: 'menu',
              localField: 'menuItemIds',
              foreignField: '_id',
              as: 'menuItems'
            }
          },
          {
            $unwind: '$menuItems'
          },
          {
            $group: {
              _id: '$menuItems.category',
              quantity: { $sum :1 },
              revenue: { $sum: '$menuItems.price'}
            }
           
          },
          {
            $project: {
              _id: 0,
              category: '$_id',
              quantity: '$quantity',
              revenue: '$revenue'
            }
          }
        ]).toArray();
          
  
        res.send(result);
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