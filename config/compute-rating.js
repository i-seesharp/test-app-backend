const computeRating = (ratings, rating) => {
    var total = 0;
    for(var i=0;i<ratings.length;i++){
        total = total + parseInt(ratings[i]);
    }
    total = total + parseInt(rating);
    return total/(ratings.length + 1);
}

module.exports = computeRating;