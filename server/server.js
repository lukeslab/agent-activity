var client;

const mongoose = require('mongoose')
// mongoose.connect(`mongodb+srv://luke:${client.iparams.get("mongodb_password")}@cluster0.320uhjy.mongodb.net/?retryWrites=true&w=majority`)
const connectDB = async () => {
  try {
    await mongoose.connect("mongodb+srv://luke:R15hGsl33gDNI0FY@cluster0.320uhjy.mongodb.net/?retryWrites=true&w=majority") // I know this is leaked, it won't be used in prod.
  } catch (error) {
    console.error(error)
  }
}

const { Schema } = mongoose
const agentSchema = new Schema({
  chatId: String,
  firstName: String,
  lastName: String,
  history: [{}],
  avatar: String
})  

exports = {
  onAgentActivityCreateHandler: async function (payload) {
    if (mongoose.connection.readyState !== 1){
      console.log('ReadyState changed. Reconnecting to db.')
      await connectDB()
    
      mongoose.connection.once('open', () => {
        console.log('Connected to mongodb')
      })
      mongoose.connection.on('error', console.error.bind(console, "connection error: "))
    }
    
    const Agent = mongoose.models.Agent || mongoose.model('Agent', agentSchema)
    const agent = await Agent.findOne({ chatId: payload.data.actor.id })

    if(agent) {
      console.log('agent found')
      return Agent.updateOne(
        {
          chatId: payload.data.actor.id
        },
        {
          history: [
            ...agent.history,
            {
              status: payload.data.agent_activity.status,
              timestamp: payload.timestamp
            }
          ]
        }
      )
    } else {
      console.log('agent not found, creating document.')
      return Agent.create({
        chatId: payload.data.actor.id,
        firstName: payload.data.actor.first_name,
        lastName: payload.data.actor.last_name,
        history: [{
          status: payload.data.agent_activity.status,
          timestamp: payload.timestamp
        }],
        avatar: payload.data.actor.avatar.url
      })
        .then( data => console.log('agent activity recorded successfully', data) )
        .catch( error => console.error(error) )
    }
  }
}
