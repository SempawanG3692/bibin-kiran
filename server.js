const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/electronics_db";
mongoose.connect(MONGO_URI)
    .then(() => console.log("✅ MongoDB Connected"))
    .catch(err => console.log("❌ MongoDB Error:", err));

/* ================== SCHEMAS ================== */
const productSchema = new mongoose.Schema({
    name: String,
    price: Number,
    image: String,
    description: String,
    stock: { type: Number, default: 0 },
    category: { type: String, default: "Other" },
    rating: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },
    ratingTotal: { type: Number, default: 0 }
});
const Product = mongoose.model("Product", productSchema);

const orderSchema = new mongoose.Schema({
    name: String,
    price: Number,
    image: String,
    productId: mongoose.Schema.Types.ObjectId,
    // Customer details
    customerName: String,
    customerEmail: String,
    customerPhone: String,
    customerAddress: String,
    paymentMethod: String,
    date: { type: Date, default: Date.now }
});
const Order = mongoose.model("Order", orderSchema);

/* ================== ROUTES ================== */
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "index.html")));

app.get("/products", async (req, res) => {
    try { res.json(await Product.find()); }
    catch (err) { res.status(500).json({ error: "Failed to fetch products" }); }
});

app.post("/add-product", async (req, res) => {
    try {
        const { name, price, image, description, stock, category } = req.body;
        if (!name || !price) return res.status(400).json({ error: "Name and price are required" });
        const product = new Product({ name, price, image, description, stock: stock || 10, category: category || "Other" });
        await product.save();
        res.json({ message: "Product Added", product });
    } catch (err) { res.status(500).json({ error: "Failed to add product" }); }
});

app.delete("/delete-product/:id", async (req, res) => {
    try { await Product.findByIdAndDelete(req.params.id); res.json({ message: "Deleted" }); }
    catch (err) { res.status(500).json({ error: "Failed to delete product" }); }
});

app.put("/update-product/:id", async (req, res) => {
    try { await Product.findByIdAndUpdate(req.params.id, req.body); res.json({ message: "Updated" }); }
    catch (err) { res.status(500).json({ error: "Failed to update product" }); }
});

/* ================== RATE PRODUCT ================== */
app.post("/rate/:id", async (req, res) => {
    try {
        const { stars } = req.body;
        if (!stars || stars < 1 || stars > 5) return res.status(400).json({ error: "Rating must be 1-5" });
        const product = await Product.findById(req.params.id);
        if (!product) return res.status(404).json({ error: "Product not found" });
        const newTotal = (product.ratingTotal || 0) + stars;
        const newCount = (product.ratingCount || 0) + 1;
        const newAvg = Math.round((newTotal / newCount) * 10) / 10;
        await Product.findByIdAndUpdate(req.params.id, { ratingTotal: newTotal, ratingCount: newCount, rating: newAvg });
        res.json({ message: "Rating saved", rating: newAvg, ratingCount: newCount });
    } catch (err) { res.status(500).json({ error: "Server error" }); }
});

/* ================== BUY WITH CUSTOMER DETAILS ================== */
app.post("/buy/:id", async (req, res) => {
    try {
        const { customerName, customerEmail, customerPhone, customerAddress, paymentMethod } = req.body;

        // Validate customer details
        if (!customerName || !customerEmail || !customerPhone || !customerAddress) {
            return res.status(400).json({ error: "All customer details are required" });
        }

        const product = await Product.findOneAndUpdate(
            { _id: req.params.id, stock: { $gt: 0 } },
            { $inc: { stock: -1 } },
            { new: true }
        );

        if (!product) {
            const exists = await Product.findById(req.params.id);
            if (!exists) return res.status(404).json({ error: "Product not found" });
            return res.status(400).json({ error: "Out of stock" });
        }

        const order = new Order({
            name: product.name,
            price: product.price,
            image: product.image,
            productId: product._id,
            customerName,
            customerEmail,
            customerPhone,
            customerAddress,
            paymentMethod: paymentMethod || "Cash on Delivery"
        });
        await order.save();
        console.log("✅ ORDER SAVED:", order.name, "→", customerName);
        res.json({ message: "Order placed successfully", order });
    } catch (err) {
        console.log("❌ ERROR:", err);
        res.status(500).json({ error: "Server error" });
    }
});

/* ================== ORDERS ================== */
app.get("/orders", async (req, res) => {
    try { res.json(await Order.find().sort({ date: -1 })); }
    catch (err) { res.status(500).json({ error: "Failed to fetch orders" }); }
});

app.delete("/cancel-order/:id", async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);
        if (!order) return res.status(404).json({ error: "Order not found" });
        await Product.findByIdAndUpdate(order.productId, { $inc: { stock: 1 } });
        await Order.findByIdAndDelete(req.params.id);
        res.json({ message: "Order cancelled successfully" });
    } catch (err) { res.status(500).json({ error: "Server error" }); }
});

app.listen(5000, () => console.log("🚀 Server running on http://localhost:5000"));