const bcrypt = require("bcrypt");

async function hashPassword() {
    const password = "lolsito"; // 🔹 Cambia esto por la contraseña real del admin
    const saltRounds = 10;
    
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    console.log("Contraseña hasheada:", hashedPassword);
}

hashPassword();
