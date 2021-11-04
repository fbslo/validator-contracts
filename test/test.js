const { expect } = require("chai");
const { ethers } = require("hardhat");

let testValidators = [
  '0xc73280617F4daa107F8b2e0F4E75FA5b5239Cf24',
  '0x2b0e9EB31C3F3BC06437A7dF090a2f6a4D658150',
  '0x265d11e5bD1646C61F6dA0AdF3b404372268BDd3',
  '0x6283375C9f25903d31BC1C8a5f9a2C4d83a69F2C'
]

let testPrivateKeys = [
  '27fe82e9f20da97c4edfb3595b89e8acab93362e054aec78c3a6acec04e820dc',
  '5cd9472be623a9179f146cb76c477016ec7157a44b75eca291ac50c68f4dce06',
  'd30aafd5f7bf07df49f18e05410320882e5cad7c5e55e48500a582b7e7605bb3',
  '1016d0f886dc50b613c75207f188e9cc46aad1381f45bb92a45b0c889ad617e8'
]

describe("MultiSignature", function () {
  let accounts;
  let multiSignature;
  let mockToken;

  async function init(){
    accounts = await ethers.getSigners();

    const MockToken = await ethers.getContractFactory("MockToken");
    mockToken = await MockToken.deploy();
    await mockToken.deployed();

    const MultiSignature = await ethers.getContractFactory("MultiSignature");
    multiSignature = await MultiSignature.deploy(testValidators, mockToken.address);
    await multiSignature.deployed();

    let tokenTransferTx = mockToken.transfer(multiSignature.address, 10000)
    await tokenTransferTx.wait()
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

  it("should transfer tokens from the contract", async function () {
    let to = accounts[0].address
    let amount = 10
    let reference = 'someString'
    let signatures = []

    for (i in testValidators){
      let wallet = new ethers.Wallet(testPrivateKeys[i]);
      let signature = await wallet.signMessage(to + amount + reference);
      signatures.push(signature)
    }

    let transferTx = await multiSignature.transfer(signatures, to, amount, reference)
    await transferTx.wait()

    let balance = await mockToken.balanceOf(multiSignature.address)

    //NOT FINISHED YET!

  });
});
