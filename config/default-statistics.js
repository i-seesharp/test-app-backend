const getDefaultStatistics = (username) => {
    return {
        "username": username,
        "statistics": {
            "easy": 0,
            "medium": 0,
            "hard": 0
        },
        "notes": [],
        "questions": [],
        "current-rating": 1200,
        "rating-history": [1200]
    }
}

module.exports = getDefaultStatistics;