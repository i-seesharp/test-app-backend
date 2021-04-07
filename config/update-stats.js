const updateStats = (stats, rating) => {
    if(rating <= 1500) stats["easy"] = stats["easy"] + 1
    else if(rating > 2000) stats["hard"] = stats["hard"] + 1
    else stats["medium"] = stats["medium"] + 1;

    return stats;
}

module.exports = updateStats;