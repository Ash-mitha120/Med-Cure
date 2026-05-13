// 1. Imports
const express = require("express");
const path = require("path");
const session = require("express-session");
const mongoose = require("mongoose");

const app = express();

// 2. MongoDB Connection
mongoose.connect("mongodb+srv://ashmitha20512_db_user:medcure123@cluster0.nonzkzb.mongodb.net/medcure")
    .then(() => console.log("✅ MongoDB Connected"))
    .catch(err => console.log(err));

// 3. Model (MOVE HERE)
const userSchema = new mongoose.Schema({
    name: String,
    phone: String,
    password: String,
    role: {
        type: String,
        enum: ["user", "doctor", "admin"],
        default: "user"
    }
});
const User = mongoose.model("User", userSchema);

const prescriptionSchema = new mongoose.Schema({
    userId: mongoose.Schema.Types.ObjectId,
    doctorId: mongoose.Schema.Types.ObjectId,

    medicines: [
        {
            name: String
        }
    ],

    createdAt: {   // ✅ comma after this block
        type: Date,
        default: Date.now
    },

    expiryDate: {  // ✅ now valid
        type: Date,
        required: true
    }

}


);
const Prescription = mongoose.model("Prescription", prescriptionSchema);

// 4. Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({
    secret: "mysecretkey",
    resave: false,
    saveUninitialized: true
}));

// 5. Auth Middleware
function isLoggedIn(req, res, next) {
    if (req.session.user) next();
    else res.redirect("/login");
}

// 6. Static + View
app.use(express.static(__dirname));
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// 7. Routes
app.get("/", isLoggedIn, (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
});

app.get("/login", (req, res) => {
    res.render("login", { message: "" });
});

app.post("/login", async (req, res) => {
    const { phone, password } = req.body;

    try {
        const user = await User.findOne({ phone: phone.trim() });

        if (user && user.password === password) {

            req.session.user = user;

            if (user.role === "doctor") {
                return res.redirect("/doctor-dashboard");
            } else {
                return res.send(`
                    <script>
                        localStorage.setItem("user", JSON.stringify({
    _id: "${user._id}",   // ✅ ADD THIS
    name: "${user.name}",
    phone: "${user.phone}",
    loggedIn: true
}));
                        window.location.href = "/";
                    </script>
                `);
            }

        } else {
            return res.render("login", { message: "Invalid credentials" });
        }

    } catch (err) {
        console.log(err);
        res.send("Error during login");
    }
});

app.get("/signup", (req, res) => {
    res.render("signup");
});

app.post("/signup", async (req, res) => {
    const { name, phone, password } = req.body;

    try {
        const newUser = new User({ name, phone, password });
        await newUser.save();

        req.session.user = newUser;

        return res.send(`
            <script>
                localStorage.setItem("user", JSON.stringify({
    _id: "${newUser._id}",   // ✅ ADD THIS
    name: "${newUser.name}",
    phone: "${newUser.phone}",
    loggedIn: true
}));
                localStorage.setItem("userLoggedIn", "true");
                window.location.href = "/";
            </script>
        `);
    } catch (err) {
        console.log(err);
        res.send("Error saving user");
    }
});

// GET prescription by ID
app.get("/api/prescriptions/user/:userId", async (req, res) => {
    try {
        const prescriptions = await Prescription.find({
            userId: req.params.userId
        });

        res.json(prescriptions);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get("/", isLoggedIn, (req, res) => {
    console.log("🔥 Home route hit");
    res.sendFile(path.join(__dirname, "index.html"));
});

app.get("/doctor-dashboard", (req, res) => {
    if (!req.session.user || req.session.user.role !== "doctor") {
        return res.redirect("/login");
    }

    res.sendFile(path.join(__dirname, "doctor.html"));
});

app.post("/add-prescription", async (req, res) => {
    const doctor = req.session.user;

    if (!doctor || doctor.role !== "doctor") {
        return res.status(403).send("Unauthorized");
    }

    const { userPhone, medicines, expiryDate } = req.body;

    const user = await User.findOne({ phone: userPhone });

    if (!expiryDate) {
        return res.send("❌ Expiry date missing");
    }

    const formattedMeds = medicines;

    const newPrescription = new Prescription({
        userId: user._id,
        doctorId: doctor._id,
        medicines: formattedMeds,
        expiryDate: new Date(expiryDate)  // ✅ safe conversion
    });

    await newPrescription.save();

    res.send("✅ Prescription added successfully");
});
app.get("/api/prescriptions/:id", async (req, res) => {
    try {
        const prescription = await Prescription.findById(req.params.id);

        if (!prescription) {
            return res.status(404).json({ error: "Not found" });
        }

        res.json(prescription);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 8. Server
app.listen(5000, () => {
    console.log("Server running on http://localhost:5000");
});