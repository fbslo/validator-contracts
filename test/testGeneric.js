const { expect } = require("chai");
const { ethers } = require("hardhat");

const abi = require('ethereumjs-abi')
const sigUtil = require("eth-sig-util")

let testValidators = [
  '0xc73280617F4daa107F8b2e0F4E75FA5b5239Cf24',
  '0x2b0e9EB31C3F3BC06437A7dF090a2f6a4D658150',
  '0x265d11e5bD1646C61F6dA0AdF3b404372268BDd3',
  '0x6283375C9f25903d31BC1C8a5f9a2C4d83a69F2C'
]

let testPrivateKeys = [
  '0x27fe82e9f20da97c4edfb3595b89e8acab93362e054aec78c3a6acec04e820dc',
  '0x5cd9472be623a9179f146cb76c477016ec7157a44b75eca291ac50c68f4dce06',
  '0xd30aafd5f7bf07df49f18e05410320882e5cad7c5e55e48500a582b7e7605bb3',
  '0x1016d0f886dc50b613c75207f188e9cc46aad1381f45bb92a45b0c889ad617e8'
]

describe("MultiSignatureGeneric", function () {
  let accounts;
  let multiSignature;
  let mockToken;

  async function init(){
    accounts = await ethers.getSigners();

    const MockToken = await ethers.getContractFactory("MockToken");
    mockToken = await MockToken.deploy();
    await mockToken.deployed();

    const MultiSignature = await ethers.getContractFactory("MultiSignatureGeneric");
    multiSignature = await MultiSignature.deploy(testValidators, mockToken.address);
    await multiSignature.deployed();

    let tokenTransferTx = mockToken.transfer(multiSignature.address, 10000)
  }

  it("should deploy contract and add validators", async function () {
    await init()

    expect(await multiSignature.tokenContract()).to.equal(mockToken.address);
    expect(await multiSignature.threshold()).to.equal(80);
    let validatorsLength = await multiSignature.getValidatorsLength()
    for (i = 0; i < validatorsLength; i++){
      expect(await multiSignature.validators(i)).to.equal(testValidators[i]);
    }
  });

  it("should transfer tokens from the contract using external call", async function () {
    let target = mockToken.address
    let to = accounts[0].address
    let amount = 1000
    let value = 0
    let signatures = []

    let parameterTypes = ["address", "uint256"];
    let parameterValues = [to, amount];
    let data = abi.rawEncode(parameterTypes, parameterValues);

    for (i in testValidators){
      let msgHash = await web3.utils.soliditySha3(target, value, 'transfer(address,uint256)', data, 0, multiSignature.address);
      let msgParams = {
        data: msgHash
      }
      if (!testPrivateKeys[i].startsWith('0x')) testPrivateKeys[i] = '0x' + testPrivateKeys[i]
      let signature = await sigUtil.personalSign(ethers.utils.arrayify(testPrivateKeys[i]), msgParams)
      signatures.push(signature)
    }

    let startContractBalance = await mockToken.balanceOf(multiSignature.address)
    let startUserBalance = await mockToken.balanceOf(accounts[0].address)


    let transferTx = await multiSignature.call(signatures, target, value, 'transfer(address,uint256)', data, 0)

    let endContractBalance = await mockToken.balanceOf(multiSignature.address)
    let endUserBalance = await mockToken.balanceOf(accounts[0].address)

    expect(startContractBalance.add(startUserBalance)).to.equal(endContractBalance.add(endUserBalance));
    expect(startContractBalance).to.equal(endContractBalance.add(amount));
    expect(endUserBalance).to.equal(startUserBalance.add(amount));
  });

  it("should add a validator", async function () {
    let newValidator = '0x7A4e3f4409873732BCE67bb76153b0c8eE0A5846'
    let newValidatorPrivateKey = '0x0c79981a4b5e364589e1d7dd6f5dc8d2cd1c9920de80266045873a0cf3a168a1'
    let nonce = await multiSignature.nonce()
    let signatures = []

    for (i in testValidators){
      let msgHash = await web3.utils.soliditySha3(newValidator, nonce, multiSignature.address);
      let msgParams = {
        data: msgHash
      }
      if (!testPrivateKeys[i].startsWith('0x')) testPrivateKeys[i] = '0x' + testPrivateKeys[i]
      let signature = await sigUtil.personalSign(ethers.utils.arrayify(testPrivateKeys[i]), msgParams)
      signatures.push(signature)
    }

    let startValidatorsLength = await multiSignature.getValidatorsLength()
    let startValidators = []
    for (i = 0; i < startValidatorsLength; i++){
      let val = await multiSignature.validators(i)
      startValidators.push(val)
    }

    let addValidatorTx = await multiSignature.addValidator(signatures, newValidator, nonce);

    let endValidatorsLength = await multiSignature.getValidatorsLength()
    let endValidators = []
    for (i = 0; i < endValidatorsLength; i++){
      let val = await multiSignature.validators(i)
      endValidators.push(val)
    }

    let expected = startValidators
    expected.push(newValidator)
    expect(JSON.stringify(endValidators)).is.equal(JSON.stringify(expected));
  });

  it("should remove a validator", async function () {
    let removedValidator = '0x7A4e3f4409873732BCE67bb76153b0c8eE0A5846'
    let removedValidatorPrivateKey = '0x0c79981a4b5e364589e1d7dd6f5dc8d2cd1c9920de80266045873a0cf3a168a1'
    let nonce = await multiSignature.nonce()
    let signatures = []

    testValidators.push(removedValidator)
    testPrivateKeys.push(removedValidatorPrivateKey)

    for (i in testValidators){
      let msgHash = await web3.utils.soliditySha3(removedValidator, nonce, multiSignature.address);
      let msgParams = {
        data: msgHash
      }
      if (!testPrivateKeys[i].startsWith('0x')) testPrivateKeys[i] = '0x' + testPrivateKeys[i]
      let signature = await sigUtil.personalSign(ethers.utils.arrayify(testPrivateKeys[i]), msgParams)
      signatures.push(signature)
    }

    testValidators.pop();
    testPrivateKeys.pop()

    let startValidatorsLength = await multiSignature.getValidatorsLength()
    let startValidators = []
    for (i = 0; i < startValidatorsLength; i++){
      let val = await multiSignature.validators(i)
      startValidators.push(val)
    }

    let removeValidatorTx = await multiSignature.removeValidator(signatures, removedValidator, nonce);

    let endValidatorsLength = await multiSignature.getValidatorsLength()
    let endValidators = []
    for (i = 0; i < endValidatorsLength; i++){
      let val = await multiSignature.validators(i)
      endValidators.push(val)
    }

    let expected = startValidators
    expected.pop()
    expect(JSON.stringify(endValidators)).is.equal(JSON.stringify(expected));
    expect(endValidatorsLength).is.equal(4);
    expect(startValidatorsLength).is.equal(5);
  });

  it("should update threshold", async function () {
    let newThreshold = 90
    let nonce = await multiSignature.nonce()
    let signatures = []

    for (i in testValidators){
      let msgHash = await web3.utils.soliditySha3(newThreshold, nonce, multiSignature.address);
      let msgParams = {
        data: msgHash
      }
      if (!testPrivateKeys[i].startsWith('0x')) testPrivateKeys[i] = '0x' + testPrivateKeys[i]
      let signature = await sigUtil.personalSign(ethers.utils.arrayify(testPrivateKeys[i]), msgParams)
      signatures.push(signature)
    }

    let startThreshold = await multiSignature.threshold()

    let updateTx = await multiSignature.updateThreshold(signatures, newThreshold, nonce)

    let endThreshold = await multiSignature.threshold()

    expect(startThreshold).is.equal(80)
    expect(endThreshold).is.equal(newThreshold)
  });
});
