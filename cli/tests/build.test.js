const {getApiVersionsSortedToDeploy} = require('../commands/build.js');


test('should return an unique api version', () => {
    const releases = [
        {
            "bonita": "2021.1",
            "apiVersions": [
                "0.0.11"
            ],
            "bonitaSemver": "7.12.x"
        }
    ];
    expect(getApiVersionsSortedToDeploy(releases)).toStrictEqual(['0.0.11']);
});

test('should return two version without duplicate when duplicate in apiVersion is given', () => {
    const releases = [
        {
            "bonita": "2021.1",
            "apiVersions": [
                "0.0.11"
            ],
            "bonitaSemver": "7.12.x"
        },
        {
            "bonita": "2021.2",
            "apiVersions": [
                "0.0.11", "0.0.12"
            ],
            "bonitaSemver": "7.12.x"
        }
    ];
    expect(getApiVersionsSortedToDeploy(releases)).toStrictEqual(['0.0.12', '0.0.11']);
});
test('should return only one deployed version ', () => {
    const releases = [
        {
            "bonita": "2021.1",
            "apiVersions": [
                "0.0.11"
            ],
            "bonitaSemver": "7.12.x"
        },
        {
            "bonita": "2021.2",
            "apiVersions": [
                "0.0.11"
            ],
            "bonitaSemver": "7.13.x"
        },
        {
            "bonita": "2022.1",
            "apiVersions": [
                "0.0.11"
            ],
            "bonitaSemver": "7.14.x"
        },
        {
            "bonita": "2022.2",
            "apiVersions": [
                "0.0.11"
            ],
            "bonitaSemver": "7.15.x"
        }
    ]
    expect(getApiVersionsSortedToDeploy(releases)).toStrictEqual(['0.0.11']);
});
