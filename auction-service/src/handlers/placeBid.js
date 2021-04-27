import AWS from 'aws-sdk';
import commonMiddleware from '../lib/commonMiddleware'
import createError from 'http-errors' ;
import { getAuctionById } from './getAuction' ;

const dynamodb = new AWS.DynamoDB.DocumentClient() ;

async function placeBid(event, context) {
    const { id } = event.pathParameters ;

    const { amount } = event.body ;
    const { email } = event.requestContext.authorizer ;

    const auction = await getAuctionById(id) ;

    // you cannot bid on your own auctions
    if (email == auction.seller)
    {
        throw new createError.Forbidden(`Your cannot bid on your own auctions!`) ;
    }

    // Avoid double bidding
    if (email == auction.highestBid.bidder){
        throw new createError.Forbidden(`Your are already the highest bidder ${auction.highestBid.bidder}`) ;
    }

    // Check status of the bid (allow only OPEN)
    if (auction.status != 'OPEN'){
        throw new createError.Forbidden(`Your cannot bid on closed auctions! ID: ${auction.id}`) ;
    }

    // Check bid amount - only allow higher amount
    if (amount <= auction.highestBid.amount){
        throw new createError.Forbidden(`Your bid must be higher than ${auction.highestBid.amount}`) ;
    }

    const params = {
        TableName: process.env.AUCTIONS_TABLE_NAME,
        Key: { id },
        UpdateExpression: 'set highestBid.amount = :amount, highestBid.bidder = :bidder',
        ExpressionAttributeValues: {
            ':amount': amount,
            ':bidder': email,
        },
        ReturnValues: 'ALL_NEW',
    }

    let updatedAuction ;

    try{
        const result = await dynamodb.update(params).promise() ;
        updatedAuction = result.Attributes ;
    }
    catch (error) {
            console.error(error) ;
            throw new createError.InternalServerError(error) ;
    }

    return {
            statusCode: 200, 
            body: JSON.stringify(auction),
    };
}

export const handler = commonMiddleware(placeBid) ;
