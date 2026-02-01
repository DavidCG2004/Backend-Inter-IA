import { Schema, model } from 'mongoose'

const interviewSchema = new Schema({
    user: {
        type: Schema.Types.ObjectId,
        ref: 'Usuario',
        required: true
    },
    type: { 
        type: String, 
        enum: ['cv', 'tech_stack', 'job_description', 'link'], 
        required: true 
    },
    contextData: {
        type: String,
        default: null
    },
    questions: [{
        questionText: String,
        category: { type: String, enum: ['theoretical', 'practical'] },
        userAnswer: { type: String, default: "" },
        aiFeedback: { type: String, default: "" },
        score: { type: Number, default: 0 }
    }],
    overallFeedback: {
        type: String,
        default: null
    }
}, {
    timestamps: true
})

export default model('Interview', interviewSchema)