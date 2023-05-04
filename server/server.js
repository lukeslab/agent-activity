const mongoose = require('mongoose')
const connectDB = async ( password ) => {
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
  first_name: String,
  last_name: String,
  history: {},
  avatar: String,
})  

exports = {
  onAgentActivityCreateHandler: async function (payload) {
    // deconstruct payload
    const { 
      data: { 
        agent_activity: { 
          availability_event_type,
          status 
        },
        actor: {
          first_name,
          last_name,
          id,
          avatar: { url }
        }, 
      }, 
      timestamp
    } = payload
    
    // The timestamp is sent with 3 decimal places in the payload and so is converted to seconds. If Freshworks eventually updates the payload to provide milliseconds or continues leaves it as seconds, this check will make sure it is in milliseconds.
    const timestampInMilliseconds = Number.isInteger(timestamp) ? timestamp : timestamp * 1000;
    
    // Get the year, month, and day from payload timestamp. Their servers are in Indian Standard Time. This causes an issue on the front end, since the shifts sometimes carry over to the next day depending on our agents timezone.
    const date = new Date(timestampInMilliseconds)
    const year = date.getFullYear()
    const month = date.getMonth() + 1 // Month returns an index, so 0 is January. Add 1 so 1 is Jan.
    const day = date.getDate() // This is day of the month, not a formatted date.

    console.log('Server time: ', timestampInMilliseconds, date.toString())

    // Check db connection
    if (mongoose.connection.readyState !== 1){
      console.log('ReadyState changed. Reconnecting to db.')
      await connectDB(payload.iparams.mongodb_password)
    
      mongoose.connection.once('open', () => {
        console.log('Connected to mongodb')
      })
      mongoose.connection.on('error', console.error.bind(console, "connection error: "))
    }
    
    // Establish mongodb model
    const Agent = mongoose.models.Agent || mongoose.model('Agent', agentSchema)

    try {
      const agent = await Agent.findOne({ chatId: id })
      
      // if agent already has a record, update it.
      if (agent) {
        const updateData = {
          status,
          timestamp: timestampInMilliseconds,
          availability_event_type
        }
        console.log(`Agent ${first_name} ${last_name} (${id}) found. Updating history:`, updateData)

        const history = agent.history
        
        // Check that the history has the year, month, day, and activity property for the given date.
        if(!history.hasOwnProperty(year)) history[year] ={}
        if(!history[year].hasOwnProperty(month)) history[year][month] = {}
        if(!history[year][month].hasOwnProperty(day)) history[year][month][day] = {}
        if(!history[year][month][day].hasOwnProperty('activity')) history[year][month][day]['activity'] = []

        // Update the activity property for the given date
        history[year][month][day]['activity'] = [
          ...history[year][month][day]['activity'],
          updateData
        ]
        
        return await Agent.updateOne({ chatId: id }, { history })
        
      } else {
        // If no agent is found, use payload data to create a document for the agent.
        console.log(`Agent not found. Creating document for Agent ${first_name} ${last_name} (${id}).`)

        // Initialize history object
        const history = {}
        history[year] = {}
        history[year][month] = {}
        history[year][month][day] = {}
        history[year][month][day]['activity'] = [{
          status,
          timestamp: timestampInMilliseconds,
          availability_event_type
        }] 

        return await Agent.create({
          chatId: id,
          first_name,
          last_name,
          history,
          avatar: url
        })
      }
    } catch (error) {
      console.log(`An Error occured: ${error}.`)
    }
  }
}
