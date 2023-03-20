const mongoose = require('mongoose')
const connectDB = async (password) => {
  try {
    // Password is available in callback function payload object
    await mongoose.connect(`mongodb+srv://luke:${password}@cluster0.320uhjy.mongodb.net/?retryWrites=true&w=majority`) 
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
      await connectDB(payload.iparams.mongodb_password)
    
      mongoose.connection.once('open', () => {
        console.log('Connected to mongodb')
      })
      mongoose.connection.on('error', console.error.bind(console, "connection error: "))
    }
    
    const Agent = mongoose.models.Agent || mongoose.model('Agent', agentSchema)
    const agent = await Agent.findOne({ chatId: payload.data.actor.id })

    if(agent) {
      console.log(`Agent ${agent.firstName} ${agent.lastName} (${agent.chatId}) found, updating history.`)
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
      const id = payload.data.actor.id;
      const firstName = payload.data.actor.first_name;
      const lastName = payload.data.actor.last_name;
      console.log(`Agent not found, creating document for Agent ${firstName} ${lastName} (${id}).`)

      return Agent.create({
        chatId: id,
        firstName: lastName,
        lastName: lastName,
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
