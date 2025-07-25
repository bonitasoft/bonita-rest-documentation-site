const {computeVersionsToRedirect, getApiVersionsSortedToDeploy, sortSemVer} = require('../commands/build.js');

describe('getApiVersionsSortedToDeploy', () => {
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

    test('should return versions without duplicate when duplicate in apiVersion is given', () => {
        const releases = [
            {
                "bonita": "2021.1",
                "apiVersions": [
                    "0.0.3", "0.0.2"
                ],
                "bonitaSemver": "7.12.x"
            },
            {
                "bonita": "2021.2",
                "apiVersions": [
                    "0.0.11", "0.0.12"
                ],
                "bonitaSemver": "7.12.x"
            },
            {
                "bonita": "2021.3",
                "apiVersions": [
                    "0.0.11", "0.0.12"
                ],
                "bonitaSemver": "7.12.x"
            }
        ];
        expect(getApiVersionsSortedToDeploy(releases)).toStrictEqual(['0.0.12', '0.0.11', '0.0.3', '0.0.2']);
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
});

describe('sortSemVer', () => {
    test('should sort versions that only differ on patch', () => {
        expect(sortSemVer(['0.0.8', '0.0.4', '0.0.25', '0.0.1'])).toStrictEqual(['0.0.1', '0.0.4', '0.0.8', '0.0.25']);
    });

    test('should sort versions from various major and minor', () => {
        expect(sortSemVer(['1.3.56', '3.1.4', '1.3.8', '0.4.8', '0.0.17', '1.3.22'])).toStrictEqual(['0.0.17', '0.4.8', '1.3.8', '1.3.22', '1.3.56', '3.1.4']);
    });

});

describe('computeVersionsToRedirect', () => {
    test('should return a single property when passing a single version ', () => {
        expect(computeVersionsToRedirect(['0.0.4'])).toStrictEqual({
            '0.0.4': ['0.0.1', '0.0.2', '0.0.3']
        });
    });

    test('should return empty object when single version with patch is zero', () => {
        expect(computeVersionsToRedirect(['2.1.0'])).toStrictEqual({});
    });

    test('should return two properties when passing two versions with the same major/minor', () => {
        expect(computeVersionsToRedirect(['0.0.4', '0.0.7'])).toStrictEqual({
            '0.0.4': ['0.0.1', '0.0.2', '0.0.3'],
            '0.0.7': ['0.0.5', '0.0.6']
        });
    });

    test('should return two properties when passing two versions with the same major but different minor', () => {
        expect(computeVersionsToRedirect(['1.1.4', '1.3.3'])).toStrictEqual({
            '1.1.4': ['1.1.0', '1.1.1', '1.1.2', '1.1.3'],
            '1.3.3': ['1.3.0', '1.3.1', '1.3.2']
        });
    });

    test('should return two properties when passing two versions with the same minor but different major', () => {
        expect(computeVersionsToRedirect(['1.1.4', '3.1.3'])).toStrictEqual({
            '1.1.4': ['1.1.0', '1.1.1', '1.1.2', '1.1.3'],
            '3.1.3': ['3.1.0', '3.1.1', '3.1.2']
        });
    });

});
