import Transaction from "../models/Transaction.js";
import Stripe from "stripe";

const plans = [
    {
        _id: "basic",
        name: "Basic",
        price: 10,
        credits: 100,
        description: "Basic Plan - 100 credits for text and image generation",
        features: ['100 text generations', '50 image generations', 'Standard support', 'Access to basic models']
    },
    {
        _id: "pro",
        name: "Pro",
        price: 20,
        credits: 500,
        description: "Pro Plan - 500 credits with priority access and support",
        features: ['500 text generations', '200 image generations', 'Priority support', 'Access to pro models', 'Faster response time']
    },
    {
        _id: "premium",
        name: "Premium",
        price: 30,
        credits: 1000,
        description: "Premium Plan - 1000 credits with VIP support and premium models",
        features: ['1000 text generations', '500 image generations', '24/7 VIP support', 'Access to premium models', 'Dedicated account manager']
    }
]

//API controller for geting all plans

export const getPlans = async (req, res) => {
    try {
        return res.json({ success: true, plans })
    } catch (error) {
        return res.json({ success: false, message: error.message })
    }
}
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
//Api controller for purchasing a plan 
export const purchasePlan = async (req, res) => {
    try {
        const { planId } = req.body;
        const userId = req.user._id;
        const plan = plans.find(plan => plan._id === planId);
        if (!plan) {
            return res.json({ success: false, message: "Invalid plan" })
        }
        //Create a transaction
        const transaction = await Transaction.create({
            userId,
            credits: plan.credits,
            planId: plan._id,
            amount: plan.price,
            isPaid: false
        })
        const { origin } = req.headers;
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [
                {
                    price_data: {
                        currency: 'usd',
                        unit_amount: plan.price * 100,
                        product_data: {
                            name: plan.name,
                            description: plan.description,
                            ...(plan.image && { images: [plan.image] }),
                        }
                    },
                    quantity: 1,


                },
            ],
            mode: 'payment',
            success_url: `${origin}/success`,
            cancel_url: `${origin}/cancel`,
            metadata: {
                transactionId: transaction._id.toString(), appId:
                    'SigmaGpt'
            },
            expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
            //Expire in 30 minutes ß
        })
        return res.json({ success: true, url: session.url })
    } catch (error) {
        return res.json({ success: false, message: error.message })
    }
}   