if (process.env.NODE_ENV !== "production") {
    require("dotenv").config()
}


const initializePassport = require("./passport-config")
const methodOverride = require("method-override")
const session = require("express-session")
const flash = require("express-flash")
const passport = require("passport")
const express = require("express")
const bcrypt = require("bcrypt")

const app = express()
const fs = require("fs")
const path = require("path")
const mysql = require("mysql2")
const multer = require("multer")
const nodemailer = require("nodemailer")
const bodyParser = require("body-parser")

const mysql_sync = require("sync-mysql")



const cors = require('cors');
app.use(cors());




var currentMail=""

initializePassport(passport)

const users = []

app.use(express.urlencoded({extended: false}))
app.use(flash())
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false
}))
app.use(passport.initialize())
app.use(passport.session())
app.use(methodOverride("_method"))

process.setMaxListeners(0);

// Set up storage for multer
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null,  path.join(__dirname, 'uploads')) // specify upload directory
    },
    filename: function (req, file, cb) {
        cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname)) // rename file
    }
});

// Initialize multer upload middleware
const upload = multer({ storage: storage });

//MySQL connect
const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  db.connect((err) => {
    if (err) {
      console.error('Error conectando a la base de datos:', err.message);
      process.exit(1);
    } else {
      console.log('Conectado a la base de datos MySQL...');
    }
  });

  // Pantalla principal
app.get('/', checkAuthenticated, (req, res) => {
    res.render("admin.ejs", {name: req.user.name})
})

//Registro

app.get('/register', checkNotAuthenticated, (req, res) => {
    res.render("register.ejs")
})

app.post("/register", checkNotAuthenticated, async (req, res) => {

    try {

        console.log("Nombre: ", req.body.name, " de tipo: ", typeof req.body.name);
        console.log("Email: ", req.body.email, " de tipo: ", typeof req.body.email);
        console.log("Pass sin hash: ", req.body.password, " de tipo: ", typeof req.body.password);

        const hashedPassword = await bcrypt.hash(req.body.password, 10)

        console.log("Pass con hash: ", hashedPassword, " de tipo: ", typeof hashedPassword);

        const usuario = req.body.name;
        const correo = req.body.email;
        const contra = hashedPassword;

        currentMail = req.body.email;

        const query = 'INSERT INTO usuarios (usuario, correo, contra, role) VALUES (?, ?, ?, ?)';
        const rol = 'comprador';
        db.execute(query, [usuario, correo, contra, rol], (err, results) => {
            if (err) {
              console.error('Error ejecutando la consulta:', err.message);
              if (err.code === 'ER_DUP_ENTRY') {
                res.render('register', { error: 'Correo ya registrado', correo: correo });
              } else {
                res.status(500).send('Error en el servidor');
              }
              console.log(results);
            }
          });
        users.push({
            id: Date.now().toString(),
            name: req.body.name,
            email: req.body.email,
            password: hashedPassword,
        })
        console.log(users);
        res.redirect("/login")

    } catch (e) {
        console.log(e);
        res.redirect("/register")
    }
})


//Inicio de sesion

app.get('/login', checkNotAuthenticated, (req, res) => {
    res.render("login.ejs")
})


app.post("/login", checkNotAuthenticated, (req, res, next) => {
    currentMail = req.body.email;
    console.log(currentMail);

    passport.authenticate("local", (err, user, info) => {
        if (err) return next(err);
        if (!user) return res.redirect("/login");

        req.logIn(user, (err) => {
            if (err) return next(err);

            // Verificar el rol del usuario
            if (user.role === "administrador") {
                return res.redirect("/admin");
            }
            
            // Si es comprador, redirigir a la página principal
            return res.redirect("/");
        });
    })(req, res, next);
});




// TODO CERRAR SESION
app.delete("/logout", (req, res) => {
    req.logout(req.user, err => {
        if (err) return next(err)
        res.redirect("/")
    })
})

// Modificar el endpoint de logout
app.get('/salida', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error("Error al cerrar sesión:", err);
            return res.status(500).send("No se pudo cerrar la sesión.");
        }
        res.redirect('/login'); // Redirige al inicio de sesión
    });
});



// Productos

//Obtener los productos
app.get('/agregar-producto', checkAuthenticated, (req, res) => {
    res.render('agregar-producto.ejs'); // Renderiza la vista "subir producto"
})


//Agregar los productos a la base de datos
app.post('/agregar-producto', upload.single('imagen'), checkAuthenticated, async (req, res) => {

    console.log("Entro al POST");

    const { nombre, precio, cantidad, categoria } = req.body;
    const imagen = req.file;

        // Check if required fields are present
    if (!nombre || !precio || !cantidad || !categoria || !imagen) {
        return res.status(400).json({ success: false, message: 'Todos los campos son requeridos' });
    }

    console.log("Correo:", currentMail);

        // Get user ID based on email
    const getUserQuery = 'SELECT usuario_id FROM usuarios WHERE correo = ?';
    var vendedorId  = 0

    db.execute(getUserQuery, [currentMail], (err,results) => {
        if(err || results.length === 0){
            console.error('Error ejecutando la consulta:', err.message);
            return res.status(500).send({ success: false, message: 'Error en el servidor' });
        }
        console.log(results)
        console.log(results[0].usuario_id, typeof results[0].usuario_id)
        vendedorId = results[0].usuario_id;
        console.log(vendedorId)

        console.log("Nombre del Producto:", nombre);
        console.log("Precio:", precio);
        console.log("Cantidad:", cantidad);
        console.log("Categoria:", categoria);
        console.log("Nombre del archivo de imagen:", imagen.filename);
        console.log("Nombre del vendedor:", vendedorId);

        const insertQuery = 'INSERT INTO productos (nombre, precio, cantidad, categoria_id, vendedor_id, nombre_imagen) VALUES (?, ?, ?, ?, ?, ?)';
        db.execute(insertQuery, [nombre, precio, cantidad, categoria, vendedorId, imagen.filename], (err, results) => {
            console.log(results)
            if(err || results.length === 0){
                console.error('Error ejecutando la consulta:', err.message);
                return res.status(500).send({ success: false, message: 'Error en el servidor' });
            }
            // Respond with success message
            console.log('Producto agregado correctamente');
            return res.status(200).json({ success: true, message: 'Producto agregado correctamente' });
        });
    });
});


//Endpoint para las categorias
app.get('/lacteos', checkAuthenticated, (req, res) => {
    res.render('lacteos.ejs');
})

app.get('/verduras', checkAuthenticated, (req, res) => {
    res.render('verduras.ejs');
})

app.get('/frutas', checkAuthenticated, (req, res) => {
    res.render('frutas.ejs');
})

app.get('/bebidas', checkAuthenticated, (req, res) => {
    res.render('bebidas.ejs');
})
app.get('/dulceria', checkAuthenticated, (req, res) => {
    res.render('dulceria.ejs');
})
app.get('/semillas', checkAuthenticated, (req, res) => {
    res.render('semillas.ejs');
})
app.get('/cereales', checkAuthenticated, (req, res) => {
    res.render('cereales.ejs');
})
app.get('/enlatados', checkAuthenticated, (req, res) => {
    res.render('enlatados.ejs');
})
app.get('/higiene', checkAuthenticated, (req, res) => {
    res.render('higiene.ejs');
})
app.get('/jugueteria', checkAuthenticated, (req, res) => {
    res.render('jugueteria.ejs');
})
app.get('/conocenos', checkAuthenticated, (req, res)=>{
    res.render('conocenos.ejs');
});
app.get('/almacen', checkAuthenticated, (req, res)=>{
    res.render('almacen.ejs');
});
app.use(express.static(path.join(__dirname, 'images')));

app.get('/data', (req, res) => {
    // Array de consulta con los IDs correspondientes a cada categoría
    const queries = [
        { id: 1, nombre: "lacteos" },
        { id: 2, nombre: "frutas" },
        { id: 3, nombre: "verduras" },
        { id: 4, nombre: "bebidas" },
        { id: 5, nombre: "dulceria" },
        { id: 6, nombre: "semillas" },
        { id: 7, nombre: "cereales" },
        { id: 8, nombre: "enlatados" },
        { id: 9, nombre: "higiene" },
        { id: 10, nombre: "jugueteria" }
    ];

    const results = [];

    // Ejecutamos una consulta por cada categoría
    queries.forEach((categoria, index) => {
        const query = `SELECT COUNT(*) AS count FROM productos WHERE categoria_id = ${categoria.id}`;
        
        db.query(query, (error, result) => {
            if (error) {
                console.error('Error ejecutando la consulta:', error);
                res.status(500).send('Error en el servidor');
                return;
            }
            
            // Guardamos el resultado (conteo de productos) junto con el nombre de la categoría
            results[index] = {
                nombre: categoria.nombre,
                count: result[0].count
            };

            // Si ya tenemos todos los resultados, los enviamos al frontend
            if (results.length === queries.length) {
                res.json(results);
            }
        });
    });
});


//Endpoint para el almacen
// Ruta para obtener todos los productos
app.get('/productos', (req, res) => {
    const query = 'SELECT producto_id, nombre, precio, cantidad, vendedor_id FROM productos';
    
    db.query(query, (error, results) => {
        if (error) {
            console.error('Error al obtener los productos:', error);
            return res.status(500).json({ error: 'Error al obtener los productos' });
        }

        res.json(results); // Enviar los productos como respuesta JSON
    });
});


//Este endpoint sirve para saber los productos por categoria en la base de datos
app.get('/productos-categoria', checkAuthenticated, (req, res) => {

    //console.log(req.query, " typeof: ", typeof req.query);

    if(Object.keys(req.query).length === 0) return res.json({});

    const categoria = req.query.categoria;

    //console.log(categoria);

    const categorias = ["lacteos", "frutas", "verduras", "bebidas", "dulceria", "semillas", "cereales", "enlatados", "higiene", "jugueteria"];

    let isValidParam = false;
    for(it in categorias){
        if(categorias[it] === categoria){
            isValidParam = true;
        }
    }

    if(!isValidParam)
        return res.json({});

    const connection = new mysql_sync({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    });

    const queryForIdCategoria = 'SELECT categoria_id FROM categorias WHERE nombre = ?;' //lacteos
    //const categoria = "lacteos";

    const resultsOfCategoria = connection.query(queryForIdCategoria, [categoria]);

    console.log(resultsOfCategoria);

    const idCategoria = resultsOfCategoria[0].categoria_id;

    console.log(idCategoria, " type: ", typeof idCategoria);
    //const queryForIdCategoria = 'SELECT categoria_id FROM categorias WHERE nombre = ?;' //lacteos

    const queryForProducts = 'SELECT * FROM productos WHERE categoria_id = ?;'

    const resultOfProducts = connection.query(queryForProducts, [idCategoria]);

    console.log(resultOfProducts);

    const listOfProducts = resultOfProducts;

    console.log("This is the for");

    for(it in listOfProducts){
        console.log(listOfProducts[it]);
    }

    res.json(
        listOfProducts
    );
});

//Endpoint para mostar las imagenes
app.get('/showImage/:nombre', checkAuthenticated, (req, res) => {
    const nombreImagen = req.params.nombre;

    //console.log(id);
    console.log(__dirname, './uploads');

    let imageExists = false;

    const files = fs.readdirSync('./uploads/');
    console.log(files);

    for (it in files){

        console.log(files[it]);

        if(files[it] === nombreImagen){
            console.log(files[it], nombreImagen);
            imageExists = true;
        }
    }

    console.log(imageExists);

    if(imageExists){
        const pathOfImage = __dirname + '/uploads/' + nombreImagen;
        console.log(pathOfImage, typeof pathOfImage);
        res.sendFile(
            pathOfImage
        );
        //res.send("Si esta la imagen")
    } else {
        const noImageRoute = __dirname + '/uploads/noImageFound.jpg'
        res.sendFile(
            noImageRoute
        );
        //res.send("No existe la imagen");
    }

});

//Endpoint para saber que tiene dentro el carrito
app.get('/productos-carrito-compra', checkAuthenticated, (req, res) => {

    const connection = new mysql_sync({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    });

    const queryToCheckUserID = 'SELECT usuario_id FROM usuarios WHERE correo = ?';
    const id_usuario_db = connection.query(queryToCheckUserID, [currentMail]);

    console.log(id_usuario_db);

    const id_usuario = id_usuario_db[0].usuario_id;

    const queryCheckCarrito = 'SELECT * FROM carritos WHERE usuario_id = ?';
    const id_carrito_db = connection.query(queryCheckCarrito, [id_usuario]);
    const id_carrito = id_carrito_db[0].carrito_id;

    console.log(currentMail, id_usuario, id_carrito);

    const queryTraerDatosCarrito = 'SELECT * FROM elementos_carrito WHERE carrito_id = ?;';
    //Ya con el carrito creado, añadimos el producto
    const elementosCarrito = connection.query(queryTraerDatosCarrito, [id_carrito]);

    console.log("elementos: ");
    console.log(elementosCarrito);

    res.send(
        elementosCarrito
    );

})

// Endpoint para eliminar un producto por ID
app.delete('/eliminar-producto/:id', checkAuthenticated, (req, res) => {
    const productoId = req.params.id;

    const connection = new mysql_sync({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    });

    const query = 'DELETE FROM productos WHERE producto_id = ?';

    try {
        connection.query(query, [productoId]);
        res.json({ success: true, message: 'Producto eliminado correctamente.' });
    } catch (error) {
        console.error('Error al eliminar el producto:', error);
        res.status(500).json({ success: false, message: 'Error al eliminar el producto.' });
    }
});


//Endpoint para lo relacionado para con el carrito de compra
app.get('/carrito-compra', checkAuthenticated, (req, res) => {
	res.render('carrito-compra.ejs');
});


//Agregar elementos al carrito
app.post('/carrito-compra', checkAuthenticated, (req, res) => {
    console.log(req.body, typeof req.body);

    const id_producto = req.body.producto_id;

    console.log(id_producto);

    const queryForIdProducto = 'SELECT * FROM productos WHERE producto_id = ?;' //lacteos

    const connection = new mysql_sync({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    });

    const resultsOfProduct = connection.query(queryForIdProducto, [id_producto]);

    console.log("EL producto es: ", resultsOfProduct); //Aqui tengo el producto

    const nuevoProducto = resultsOfProduct[0];

    const queryToCheckUserID = 'SELECT usuario_id FROM usuarios WHERE correo = ?';

    const id_usuario_db = connection.query(queryToCheckUserID, [currentMail]);

    const id_usuario = id_usuario_db[0].usuario_id
    console.log("ESTE ES EL ID: ", id_usuario);
    //Meterlo en la base de datos

    const queryCheckCarrito = 'SELECT * FROM carritos WHERE usuario_id = ?';

    const existeCarrito = connection.query(queryCheckCarrito, [id_usuario]);

    console.log("Esta es la query del carrito: ", existeCarrito);



    if(existeCarrito.length === 0){

        console.log("NO EXISTE EL CARRITO");
        //Creamos el carrito y su elemento
        const queryCreateCarrito = 'INSERT INTO carritos (usuario_id) VALUES (?);';
        connection.query(queryCreateCarrito, [id_usuario]);
        console.log("Carrito creado correctamente");

        const queryCheckIdCarrito = 'SELECT carrito_id FROM carritos WHERE usuario_id = ?;'
        const id_carrito_db = connection.query(queryCheckIdCarrito, [id_usuario]);

        const carrito_id = id_carrito_db[0].carrito_id; //EL id del carrito del usuario actualmente que hizo login
        console.log("Carrito id: ", carrito_id, " type: ", typeof carrito_id);

        //Creamos sus elementos, vacio
        const queryCreateElementosCarrito = 'INSERT INTO elementos_carrito(carrito_id, productos_comprados, precio_total) VALUES(?, \'[]\', 0);';
        connection.query(queryCreateElementosCarrito, [carrito_id]);

        console.log("Carrito de elementos creado correctamente");


    } else {
        console.log("SI EXISTE EL CARRITO");
    }


    const queryCheckIdCarrito = 'SELECT carrito_id FROM carritos WHERE usuario_id = ?;'
    const id_carrito_db = connection.query(queryCheckIdCarrito, [id_usuario]);
    carrito_id = id_carrito_db[0].carrito_id;

    //TODO: Hacer validacion
    const queryTraerDatosCarrito = 'SELECT * FROM elementos_carrito WHERE carrito_id = ?;';
    //Ya con el carrito creado, añadimos el producto

    const elementosCarrito = connection.query(queryTraerDatosCarrito, [carrito_id]);
    //console.log("LOG: ", carrito_id, elementosCarrito);

    console.log(elementosCarrito[0], nuevoProducto);

    const elementoCarritoNuevo = elementosCarrito[0];

    console.log(elementoCarritoNuevo, " - ", nuevoProducto);


    //const nuevoProductosComprados = elementoCarritoNuevo.append(nuevoProducto);
    //const nuevoPrecioTotal = 0;

    const json_elemento_carrito = JSON.parse(elementoCarritoNuevo.productos_comprados);

    const sizeArray = json_elemento_carrito.length;
    json_elemento_carrito[sizeArray] = nuevoProducto;

    console.log(json_elemento_carrito[sizeArray]);

    console.log("Precio total: ", elementoCarritoNuevo.precio_total);
    console.log("Precio nuevo producto: ", nuevoProducto.precio);
    console.log("Cantidad nuevo producto: ", nuevoProducto.cantidad);

    const nuevoPrecioTotal = elementoCarritoNuevo.precio_total + (nuevoProducto.precio * nuevoProducto.cantidad);

    console.log(nuevoPrecioTotal, " type: ", typeof nuevoPrecioTotal);

    const queryToUpdateCarrito = 'UPDATE elementos_carrito SET productos_comprados = ?, precio_total = ? WHERE carrito_id = ?;'
    connection.query(queryToUpdateCarrito, [JSON.stringify(json_elemento_carrito), nuevoPrecioTotal, carrito_id]);

    console.log("Se inserto correctamente");

    console.log(currentMail)

    res.redirect('/');
});

// Endpoint para mostrar el carrito de compras
app.get('/carrito-compra', checkAuthenticated, (req, res) => {
    res.render('carrito-compra.ejs');
});

// Vaciar el carrito completo
app.delete('/vaciar-carrito', checkAuthenticated, (req, res) => {
    const connection = new mysql_sync({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    });

    const queryToCheckUserID = 'SELECT usuario_id FROM usuarios WHERE correo = ?';
    const id_usuario_db = connection.query(queryToCheckUserID, [currentMail]);
    const id_usuario = id_usuario_db[0].usuario_id;

    const queryCheckIdCarrito = 'SELECT carrito_id FROM carritos WHERE usuario_id = ?;';
    const id_carrito_db = connection.query(queryCheckIdCarrito, [id_usuario]);
    const carrito_id = id_carrito_db[0].carrito_id;

    // Vacía los productos y pone el precio_total en 0
    const queryVaciarCarrito = 'UPDATE elementos_carrito SET productos_comprados = ?, precio_total = ? WHERE carrito_id = ?;';
    connection.query(queryVaciarCarrito, ['[]', 0, carrito_id]);

    res.json({ success: true, message: 'Carrito vaciado correctamente' });
});

//Endpoint para borrar un producto del carrito
app.delete('/carrito-compra/:id_producto', checkAuthenticated, (req, res) => {
    const id_producto_a_eliminar = parseInt(req.params.id_producto); // ID del producto a eliminar
    const correo_usuario = currentMail;

    const connection = new mysql_sync({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    });

    try {
        // Obtener el ID del usuario actual
        const queryUserId = 'SELECT usuario_id FROM usuarios WHERE correo = ?';
        const userResult = connection.query(queryUserId, [correo_usuario]);

        if (userResult.length === 0) {
            return res.status(404).send("Usuario no encontrado.");
        }

        const id_usuario = userResult[0].usuario_id;

        // Obtener el carrito del usuario
        const queryCarrito = `
            SELECT ec.carrito_id, ec.productos_comprados, ec.precio_total
            FROM carritos c
            INNER JOIN elementos_carrito ec ON c.carrito_id = ec.carrito_id
            WHERE c.usuario_id = ?`;

        const carritoResult = connection.query(queryCarrito, [id_usuario]);

        if (carritoResult.length === 0) {
            return res.status(404).send("Carrito no encontrado.");
        }

        const carrito_id = carritoResult[0].carrito_id;
        let productos_comprados = JSON.parse(carritoResult[0].productos_comprados);
        let precio_total_actual = carritoResult[0].precio_total;

        // Filtrar el producto que queremos eliminar
        const nuevosProductos = productos_comprados.filter(producto => {
            return producto.producto_id && producto.producto_id !== id_producto_a_eliminar;
        });

        // Validar si el producto no existía
        if (nuevosProductos.length === productos_comprados.length) {
            return res.status(400).send("El producto no existe en el carrito.");
        }

        // Calcular el nuevo precio total
        const nuevoPrecioTotal = nuevosProductos.reduce((total, producto) => {
            return total + (producto.precio * producto.cantidad);
        }, 0);

        // Actualizar el carrito en la base de datos
        const queryUpdateCarrito = `
            UPDATE elementos_carrito 
            SET productos_comprados = ?, precio_total = ? 
            WHERE carrito_id = ?`;

        connection.query(queryUpdateCarrito, [JSON.stringify(nuevosProductos), nuevoPrecioTotal, carrito_id]);

        console.log(`Producto ${id_producto_a_eliminar} eliminado correctamente.`);
        res.status(200).json({
            mensaje: "Producto eliminado correctamente.",
            nuevosProductos,
            nuevoPrecioTotal
        });

    } catch (error) {
        console.error("Error al eliminar el producto:", error);
        res.status(500).send("Error interno del servidor.");
    }
});

app.get('/obtener-carrito', (req, res) => {
    const connection = new mysql_sync({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME
    });
  
    const currentMail = req.query.email; // Asume que el email se pasa como parámetro de consulta
  
    const queryToCheckUserID = 'SELECT usuario_id FROM usuarios WHERE correo = ?';
    const id_usuario_db = connection.query(queryToCheckUserID, [currentMail]);
  
    if (id_usuario_db.length === 0) {
      return res.status(404).json({ success: false, message: "Usuario no encontrado" });
    }
  
    const id_usuario = id_usuario_db[0].usuario_id;
  
    const queryCheckIdCarrito = 'SELECT carrito_id FROM carritos WHERE usuario_id = ?;';
    const id_carrito_db = connection.query(queryCheckIdCarrito, [id_usuario]);
  
    if (id_carrito_db.length === 0) {
      return res.status(404).json({ success: false, message: "Carrito no encontrado" });
    }
  
    const carrito_id = id_carrito_db[0].carrito_id;
  
    const queryGetCarrito = 'SELECT * FROM elementos_carrito WHERE carrito_id = ?';
    const carrito = connection.query(queryGetCarrito, [carrito_id]);
  
    res.json(carrito);
  });
  



app.get('/obtener-carrito', (req, res) => {
    const connection = new mysql_sync({
       host: process.env.DB_HOST,
       user: process.env.DB_USER,
       password: process.env.DB_PASSWORD,
       database: process.env.DB_NAME
        });
    // Suponiendo que tienes una conexión a la base de datos llamada 'connection'
    const queryToCheckUserID = 'SELECT usuario_id FROM usuarios WHERE correo = ?';
    const id_usuario_db = connection.query(queryToCheckUserID, [currentMail]);
    const id_usuario = id_usuario_db[0].usuario_id
    console.log("ESTE ES EL ID: ", id_usuario);
    const queryCheckIdCarrito = 'SELECT carrito_id FROM carritos WHERE usuario_id = ?;'
    const id_carrito_db = connection.query(queryCheckIdCarrito, [id_usuario]);
    carrito_id = id_carrito_db[0].carrito_id;
    connection.query('SELECT * FROM elementos_carrito WHERE carrito_id = ?', [carrito_id], (error, results) => {
        if (error) throw error;
        res.json(results);
    });
});

app.use(bodyParser.json()); // Middleware para parsear JSON

// Configuración del transporte de correo
const transporter = nodemailer.createTransport({
    service: 'gmail', // Ejemplo con Gmail
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS

    }
});

// Ruta para enviar el correo
app.post('/enviar-correo', (req, res) => {
    const { productos, total } = req.body;

    // Obtener el correo del usuario actual (puedes obtenerlo del objeto de sesión o JWT, dependiendo de tu autenticación)
    const correoUsuario = currentMail; // Aquí debes obtener el correo del usuario que está autenticado

    // Crear el contenido del correo
    let contenidoCorreo = '<h2>Resumen de tu compra</h2><ul>';
    productos.forEach(producto => {
        contenidoCorreo += `<li>${producto.nombre} - Cantidad: ${producto.cantidad}, Precio: $${producto.precio}</li>`;
    });
    contenidoCorreo += `</ul><p><strong>Total a pagar: $${total}</strong></p>`;

    // Configuración del correo
    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: correoUsuario, // Correo del usuario
        subject: 'Confirmación de compra',
        html: contenidoCorreo
    };

    // Enviar el correo
    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            console.error('Error al enviar el correo:', error);
            res.status(500).json({ success: false, message: 'Error al enviar el correo.' });
        } else {
            console.log('Correo enviado:', info.response);
            res.json({ success: true, message: 'Correo enviado exitosamente.' });
        }
    });
});


 


function checkAuthenticated(req, res, next){
    if(req.isAuthenticated()){
        return next()
    }
    res.redirect("/login")
}

function checkNotAuthenticated(req, res, next){
    if(req.isAuthenticated()){
        return res.redirect("/")
    }
    next()
}

app.listen(3001)



app.get("/graficas", checkAuthenticated, (req, res) => {
    res.render("graficas.ejs"); 
});

app.get("/admin", checkAuthenticated, (req, res) => {
    res.render("admin.ejs"); 
});








/* MEJORAS CARRITO
app.get('/obtener-carrito', checkAuthenticated, async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT usuario_id FROM usuarios WHERE correo = ?', [req.user.email]);

        if (rows.length === 0) return res.status(404).json({ success: false, message: "Usuario no encontrado" });

        const usuario_id = rows[0].usuario_id;

        const [carrito] = await pool.query('SELECT * FROM elementos_carrito WHERE carrito_id = (SELECT carrito_id FROM carritos WHERE usuario_id = ?)', [usuario_id]);

        res.json({ success: true, carrito });

    } catch (error) {
        console.error("Error obteniendo carrito:", error);
        res.status(500).json({ success: false, message: "Error interno del servidor" });
    }
});


app.post('/carrito-compra', checkAuthenticated, async (req, res) => {
    try {
        const { producto_id, cantidad } = req.body;
        const [producto] = await pool.query('SELECT * FROM productos WHERE producto_id = ?', [producto_id]);

        if (producto.length === 0) return res.status(404).json({ message: "Producto no encontrado" });

        const [usuario] = await pool.query('SELECT usuario_id FROM usuarios WHERE correo = ?', [req.user.email]);
        const usuario_id = usuario[0].usuario_id;

        let [carrito] = await pool.query('SELECT carrito_id FROM carritos WHERE usuario_id = ?', [usuario_id]);

        if (carrito.length === 0) {
            await pool.query('INSERT INTO carritos (usuario_id) VALUES (?)', [usuario_id]);
            [carrito] = await pool.query('SELECT carrito_id FROM carritos WHERE usuario_id = ?', [usuario_id]);
            await pool.query('INSERT INTO elementos_carrito (carrito_id, productos_comprados, precio_total) VALUES (?, ?, ?)', [carrito[0].carrito_id, '[]', 0]);
        }

        const carrito_id = carrito[0].carrito_id;
        const [elemento] = await pool.query('SELECT * FROM elementos_carrito WHERE carrito_id = ?', [carrito_id]);

        let productos = JSON.parse(elemento[0].productos_comprados);
        productos.push({ producto_id, cantidad, precio: producto[0].precio });

        const nuevoPrecioTotal = productos.reduce((acc, p) => acc + (p.precio * p.cantidad), 0);

        await pool.query('UPDATE elementos_carrito SET productos_comprados = ?, precio_total = ? WHERE carrito_id = ?', [JSON.stringify(productos), nuevoPrecioTotal, carrito_id]);

        res.json({ message: "Producto añadido", carrito: productos });

    } catch (error) {
        console.error("Error añadiendo producto:", error);
        res.status(500).json({ message: "Error interno del servidor" });
    }
});


app.delete('/carrito-compra/:id_producto', checkAuthenticated, async (req, res) => {
    try {
        const id_producto = parseInt(req.params.id_producto);
        const [usuario] = await pool.query('SELECT usuario_id FROM usuarios WHERE correo = ?', [req.user.email]);

        if (usuario.length === 0) return res.status(404).json({ message: "Usuario no encontrado" });

        const usuario_id = usuario[0].usuario_id;

        const [carrito] = await pool.query('SELECT * FROM carritos WHERE usuario_id = ?', [usuario_id]);

        if (carrito.length === 0) return res.status(404).json({ message: "Carrito no encontrado" });

        const carrito_id = carrito[0].carrito_id;
        const [elemento] = await pool.query('SELECT * FROM elementos_carrito WHERE carrito_id = ?', [carrito_id]);

        let productos = JSON.parse(elemento[0].productos_comprados);
        productos = productos.filter(p => p.producto_id !== id_producto);

        const nuevoPrecioTotal = productos.reduce((acc, p) => acc + (p.precio * p.cantidad), 0);

        await pool.query('UPDATE elementos_carrito SET productos_comprados = ?, precio_total = ? WHERE carrito_id = ?', [JSON.stringify(productos), nuevoPrecioTotal, carrito_id]);

        if (productos.length === 0) {
            await pool.query('DELETE FROM carritos WHERE usuario_id = ?', [usuario_id]);
        }

        res.json({ message: "Producto eliminado", carrito: productos });

    } catch (error) {
        console.error("Error eliminando producto:", error);
        res.status(500).json({ message: "Error interno del servidor" });
    }
});


app.delete('/vaciar-carrito', checkAuthenticated, async (req, res) => {
    try {
        const [usuario] = await pool.query('SELECT usuario_id FROM usuarios WHERE correo = ?', [req.user.email]);

        if (usuario.length === 0) return res.status(404).json({ message: "Usuario no encontrado" });

        const usuario_id = usuario[0].usuario_id;
        await pool.query('DELETE FROM carritos WHERE usuario_id = ?', [usuario_id]);

        res.json({ message: "Carrito vaciado correctamente" });

    } catch (error) {
        console.error("Error vaciando carrito:", error);
        res.status(500).json({ message: "Error interno del servidor" });
    }
});


*/



/* MEJORAS FILTROS CATEGORÍAS
const categorias = ['Programación', 'Mecatrónica', 'Sistemas Digitales', 'Dibujo técnico', 'Tronco común'];
categorias.forEach(categoria => {
    app.get(`/${categoria}`, checkAuthenticated, (req, res) => {
        res.render(`${categoria}.ejs`);
    });
});

app.use(express.static(path.join(__dirname, 'images')));

// Ruta para obtener datos de productos por categoría
app.get('/data', (req, res) => {
    const queries = [
        { id: 1, nombre: "Programación" },
        { id: 2, nombre: "Mecatrónica" },
        { id: 3, nombre: "Sistemas Digitales" },
        { id: 4, nombre: "Dibujo t´pecnico" },
        { id: 5, nombre: "Tronco común },
    ];

    const results = [];
    let completedQueries = 0;

    queries.forEach((categoria, index) => {
        const query = `SELECT COUNT(*) AS count FROM productos WHERE categoria_id = ${categoria.id}`;
        db.query(query, (error, result) => {
            if (error) {
                console.error('Error ejecutando la consulta:', error);
                res.status(500).send('Error en el servidor');
                return;
            }
            results[index] = {
                nombre: categoria.nombre,
                count: result[0].count
            };
            completedQueries++;
            if (completedQueries === queries.length) {
                res.json(results);
            }
        });
    });
});

// Ruta para obtener productos filtrados por catálogo o plantel
app.get('/productos', checkAuthenticated, (req, res) => {
    const { catalogo_id, plantel_id } = req.query;
    let query = 'SELECT * FROM productos';
    let params = [];
    
    if (catalogo_id) {
        query += ' WHERE catalogo_id = ?';
        params.push(catalogo_id);
    } else if (plantel_id) {
        query += ' WHERE plantel_id = ?';
        params.push(plantel_id);
    }
    
    db.query(query, params, (error, results) => {
        if (error) {
            console.error('Error al obtener productos:', error);
            return res.status(500).json({ error: 'Error interno del servidor' });
        }
        res.json(results);
    });
});

// Ruta para obtener productos por categoría
app.get('/productos-categoria', checkAuthenticated, (req, res) => {
    if (!req.query.categoria) return res.json({});

    const categoria = req.query.categoria;
    const categoriasValidas = ['Programación', 'Mecatrónica', 'Sistemas Digitales', 'Dibujo técnico', 'Tronco común'];
    if (!categoriasValidas.includes(categoria)) return res.json({});

    const queryForIdCategoria = 'SELECT categoria_id FROM categorias WHERE nombre = ?';
    db.query(queryForIdCategoria, [categoria], (error, results) => {
        if (error || results.length === 0) {
            console.error('Error obteniendo la categoría:', error);
            return res.status(500).json({ error: 'Error en el servidor' });
        }
        const idCategoria = results[0].categoria_id;

        const queryForProducts = 'SELECT * FROM productos WHERE categoria_id = ?';
        db.query(queryForProducts, [idCategoria], (error, results) => {
            if (error) {
                console.error('Error obteniendo productos:', error);
                return res.status(500).json({ error: 'Error en el servidor' });
            }
            res.json(results);
        });
    });
});
*/



