const express= require('express');
const fs =require('fs');
const app = express();
const path = require('path');

app.use(express.json())
app.use(express.urlencoded({extended:true}))
app.set("view engine","ejs")
app.use(express.static(path.join(__dirname , "public")))

app.get('/', function(req, res){
fs.readdir(`./files`, function(err, files){
    res.render("index",{files:files})
    
})
})
app.get('/file/:filename', function(req, res) {
    const filePath = `./files/${req.params.filename}`; 

    fs.readFile(filePath, 'utf-8', function(err, filedata) {
        if (err) {
            console.error(err);
            res.status(500).send('Error reading the file');
            return;
        }

        res.render('content', { filename: req.params.filename, filedata: filedata });
    });
});
app.get('/edit/:filename',function(req, res){
    res.render('name',{filename:req.params.filename})
})
app.post('/create',function(req, res){
    fs.writeFile(`./files/${req.body.title.split(' ').join('')}.txt`, req.body.content,function(err){
res.redirect("/")
    })
})
app.post('/edit',function(req,res){
    
    fs.rename(`./files/${req.body.oldname}`, `./files/${req.body.newname}`, function(err){
        res.redirect("/");
    })

})

app.post('/delete-operation', (req, res) => {
    const filename = req.body.filename; 
    const filePath = path.join(__dirname, 'files', filename); 
    if (!filename) {
        return res.status(400).send('Filename is required');
    }

    // Delete the file
    fs.unlink(filePath, function(err) {
        if(err){
            console.err(err);
        }
       

        
    });
});



    


app.listen(3000, function(){
    console.log("server is listening on port 3000")
})


