
module.exports = function () {
    return {
     random100 : () =>{
        return  Math.floor(Math.random() * 101)
     },
     random1045 : () =>{
        return Math.floor(Math.random() * 40) + 16;
     }

  };
}  