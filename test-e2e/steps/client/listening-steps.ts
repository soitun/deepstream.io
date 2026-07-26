import { defaultDelay } from '../../framework/utils'
import {When, Then} from 'cucumber'
const { listening } = require(`../../framework${process.env.V3 ? '-v3' : ''}/listening`)

When(/^publisher (.+) (accepts|rejects) (?:a|an) (event|record) match "([^"]*)" for pattern "([^"]*)"$/, (clientExpression: string, action: string, type: string, subscriptionName: string, pattern: string) => {
  listening.setupListenResponse(clientExpression, action === 'accepts', type, subscriptionName, pattern)
})

When(/^publisher (.+) listens to (?:a|an) (event|record) with pattern "([^"]*)"$/, (clientExpression: string, type: string, pattern: string, done: () => void) => {
  listening.listens(clientExpression, type, pattern)
  setTimeout(done, defaultDelay)
})

When(/^publisher (.+) unlistens to the (event|record) pattern "([^"]*)"$/, (clientExpression: string, type: string, pattern: string, done: () => void) => {
  listening.unlistens(clientExpression, type, pattern)
  setTimeout(done, defaultDelay)
})

Then(/^publisher (.+) does not receive (?:a|an) (event|record) match "([^"]*)" for pattern "([^"]*)"$/, listening.assert.doesNotRecieveMatch)

Then(/^publisher (.+) receives (\d+) (event|record) (?:match|matches) "([^"]*)" for pattern "([^"]*)"$/, listening.assert.recievesMatch)

Then(/^publisher (.+) removed (\d+) (event|record) (?:match|matches) "([^"]*)" for pattern "([^"]*)"$/, listening.assert.receivedUnMatch)
